import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { isFreshActiveTimestamp, verifyActiveSignature } from "../lib/active-signature.js";
import { completeExtractionRunFromCallback } from "../lib/inbox-processing.js";
import { activepiecesExtractionSchema } from "../lib/activepieces-provider.js";

const callbackPayloadSchema = z.discriminatedUnion("status", [
  z.object({
    extractionRunId: z.string().min(1),
    status: z.literal("SUCESSO"),
    workflowId: z.string().min(1).optional().nullable(),
    rawResponse: z.string().optional().nullable(),
    durationMs: z.coerce.number().int().nonnegative().optional().nullable(),
    providerMeta: z.record(z.string(), z.unknown()).optional().nullable(),
    parsed: activepiecesExtractionSchema
  }),
  z.object({
    extractionRunId: z.string().min(1),
    status: z.literal("ERRO"),
    workflowId: z.string().min(1).optional().nullable(),
    rawResponse: z.string().optional().nullable(),
    durationMs: z.coerce.number().int().nonnegative().optional().nullable(),
    errorMessage: z.string().min(1)
  })
]);

const inboxWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/inbox/extraction-callback", async (request, reply) => {
    const timestamp = typeof request.headers["x-initi-timestamp"] === "string" ? request.headers["x-initi-timestamp"] : null;
    const signature = typeof request.headers["x-initi-signature"] === "string" ? request.headers["x-initi-signature"] : null;
    const rawBody =
      typeof request.rawBody === "string"
        ? request.rawBody
        : request.body && typeof request.body === "object"
          ? JSON.stringify(request.body)
          : null;

    if (!timestamp || !signature || !rawBody || !isFreshActiveTimestamp(timestamp) || !verifyActiveSignature({ rawBody, signature, timestamp })) {
      reply.code(401);
      return { message: "Invalid Active Actions signature" };
    }

    const payload = callbackPayloadSchema.parse(request.body);
    const result = await completeExtractionRunFromCallback(payload);

    return {
      ok: true,
      mode: result.mode,
      extractionRunId: result.extractionRunId,
      draftId: result.draftId ?? null,
      emailId: result.emailId
    };
  });
};

export default inboxWebhookRoutes;
