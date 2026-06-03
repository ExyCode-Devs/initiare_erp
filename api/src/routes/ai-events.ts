import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { ingestExternalNormalizedDraft, resolveDefaultCompanyId } from "../lib/ai-draft-service.js";

const legacyRouteMessage = "Legacy AI ingress disabled. Use /api/ai/events/financial-drafts.";

const financialDirectionSchema = z
  .enum(["CONTA_PAGAR", "CONTA_RECEBER", "conta_pagar", "conta_receber"])
  .transform((value) => (value === "conta_pagar" ? "CONTA_PAGAR" : value === "conta_receber" ? "CONTA_RECEBER" : value));

const payloadSchema = z.object({
  eventId: z.string().min(1),
  occurredAt: z.string().datetime(),
  source: z.object({
    channel: z.string().min(2),
    sender: z.string().optional().nullable(),
    subject: z.string().optional().nullable(),
    summary: z.string().optional().nullable(),
    attachments: z.array(z.record(z.string(), z.unknown())).optional().default([])
  }),
  draft: z.object({
    direction: financialDirectionSchema,
    partyName: z.string().min(2),
    cpfCnpj: z.string().optional().nullable(),
    amount: z.coerce.number().positive().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    competence: z.string().optional().nullable(),
    description: z.string().min(2),
    suggestedCategory: z.string().optional().nullable(),
    paymentMethod: z.string().optional().nullable(),
    bankData: z.record(z.string(), z.unknown()).optional().nullable(),
    notes: z.string().optional().nullable(),
    evidence: z.array(z.string()).optional().nullable()
  }),
  ai: z.object({
    provider: z.string().min(2),
    confidenceScore: z.coerce.number().min(0).max(100),
    rawResponse: z.string().min(1),
    providerMeta: z.record(z.string(), z.unknown()).optional().nullable(),
    durationMs: z.coerce.number().int().nonnegative().optional().nullable()
  })
});

function verifySignature(input: { rawBody: string; signature: string; timestamp: string }) {
  const expected = createHmac("sha256", env.ACTIVE_ACTIONS_HMAC_SECRET)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex");

  const left = Buffer.from(input.signature, "hex");
  const right = Buffer.from(expected, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function isFreshTimestamp(timestamp: string) {
  const receivedAt = Number(new Date(timestamp));
  if (Number.isNaN(receivedAt)) {
    return false;
  }

  return Math.abs(Date.now() - receivedAt) <= env.ACTIVE_ACTIONS_MAX_SKEW_MS;
}

const aiEventRoutes: FastifyPluginAsync = async (app) => {
  app.post("/ai/events/financial-drafts", async (request, reply) => {
    const timestamp = typeof request.headers["x-initi-timestamp"] === "string" ? request.headers["x-initi-timestamp"] : null;
    const signature = typeof request.headers["x-initi-signature"] === "string" ? request.headers["x-initi-signature"] : null;
    const rawBody =
      typeof request.rawBody === "string"
        ? request.rawBody
        : request.body && typeof request.body === "object"
          ? JSON.stringify(request.body)
          : null;

    if (!timestamp || !signature || !rawBody || !isFreshTimestamp(timestamp) || !verifySignature({ rawBody, signature, timestamp })) {
      reply.code(401);
      return { message: "Invalid Active Actions signature" };
    }

    const payload = payloadSchema.parse(request.body);
    const companyId = await resolveDefaultCompanyId();
    const result = await ingestExternalNormalizedDraft({
      companyId,
      eventId: payload.eventId,
      occurredAt: payload.occurredAt,
      originType: "ACTIVE_ACTIONS",
      source: payload.source,
      draft: payload.draft,
      ai: payload.ai,
      rawPayload: payload
    });

    return {
      ok: true,
      mode: result.mode,
      eventSourceId: result.eventSourceId,
      aiRunId: result.aiRunId,
      draftId: result.draftId
    };
  });

  app.all("/webhooks/invoices", async (request, reply) => {
    reply.code(410);
    return {
      message: legacyRouteMessage,
      path: request.url
    };
  });
};

export default aiEventRoutes;
