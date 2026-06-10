import { createHmac } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $queryRaw: vi.fn(),
  user: {
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

const aiDraftServiceMock = {
  ingestExternalNormalizedDraft: vi.fn(),
};

const legalEntitiesMock = {
  resolveCompanyFromDraftRoute: vi.fn(),
};

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../../api/src/lib/ai-draft-service.js", () => aiDraftServiceMock);
vi.mock("../../api/src/lib/legal-entities.js", () => legalEntitiesMock);

async function buildTestApp() {
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test";
  process.env.JWT_SECRET = "12345678901234567890123456789012";
  process.env.APP_ORIGIN = "http://localhost:8080";
  process.env.ACTIVE_ACTIONS_HMAC_SECRET = "active-actions-secret-123456789012";
  process.env.NODE_ENV = "test";

  const { buildApp } = await import("../../api/src/app.ts");
  return buildApp();
}

function signPayload(body: string, timestamp: string) {
  return createHmac("sha256", process.env.ACTIVE_ACTIONS_HMAC_SECRET!)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

describe("app routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    app = await buildTestApp();
  }, 20000);

  afterEach(async () => {
    await app?.close();
  });

  it("logs in successfully with valid credentials", async () => {
    const { hashPassword } = await import("../../api/src/lib/auth.ts");
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Admin User",
      email: "admin@example.com",
      passwordHash: await hashPassword("ChangeMe123!"),
      memberships: [
        {
          id: "membership-1",
          role: "ADMIN",
          isDefault: true,
          companyId: "company-1",
          company: {
            id: "company-1",
            name: "Initiare",
            domain: "localhost",
          },
        },
      ],
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: "admin@example.com",
        password: "ChangeMe123!",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().token).toBeTypeOf("string");
    expect(prismaMock.auditLog.create).toHaveBeenCalledOnce();
  });

  it("blocks protected route without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/financial-drafts",
    });

    expect(response.statusCode).toBe(401);
  });

  it("accepts valid signed Active Actions event", async () => {
    legalEntitiesMock.resolveCompanyFromDraftRoute.mockResolvedValue({
      companyId: "company-1",
      legalEntityId: "legal-1",
      routingStatus: "ROUTED",
      routeSource: "MAILBOX",
      routingReason: "Routed by mailbox alias finance"
    });
    aiDraftServiceMock.ingestExternalNormalizedDraft.mockResolvedValue({
      mode: "created",
      eventSourceId: "event-1",
      aiRunId: "run-1",
      draftId: "draft-1",
    });

    const payload = JSON.stringify({
      eventId: "evt-1",
      occurredAt: new Date().toISOString(),
      source: {
        channel: "gmail",
        sender: "billing@example.com",
        subject: "Invoice",
        summary: "Invoice summary",
        attachments: [],
      },
      draft: {
        direction: "CONTA_PAGAR",
        partyName: "CloudPlus",
        description: "Monthly invoice",
      },
      ai: {
        provider: "active-actions-gateway",
        confidenceScore: 89,
        rawResponse: "{\"ok\":true}",
      },
    });
    const timestamp = new Date().toISOString();

    const response = await app.inject({
      method: "POST",
      url: "/api/ai/events/financial-drafts",
      payload,
      headers: {
        "content-type": "application/json",
        "x-initi-timestamp": timestamp,
        "x-initi-signature": signPayload(payload, timestamp),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      mode: "created",
      eventSourceId: "event-1",
      aiRunId: "run-1",
      draftId: "draft-1",
    });
    expect(aiDraftServiceMock.ingestExternalNormalizedDraft).toHaveBeenCalledOnce();
  });

  it("returns duplicate mode for repeated event", async () => {
    legalEntitiesMock.resolveCompanyFromDraftRoute.mockResolvedValue({
      companyId: "company-1",
      legalEntityId: "legal-1",
      routingStatus: "ROUTED",
      routeSource: "MAILBOX",
      routingReason: "Routed by mailbox alias finance"
    });
    aiDraftServiceMock.ingestExternalNormalizedDraft.mockResolvedValue({
      mode: "duplicate",
      eventSourceId: "event-1",
      aiRunId: "run-1",
      draftId: "draft-1",
    });

    const payload = JSON.stringify({
      eventId: "evt-dup-1",
      occurredAt: new Date().toISOString(),
      source: { channel: "gmail" },
      draft: {
        direction: "CONTA_RECEBER",
        partyName: "Globex",
        description: "Receivable",
      },
      ai: {
        provider: "active-actions-gateway",
        confidenceScore: 75,
        rawResponse: "{\"ok\":true}",
      },
    });
    const timestamp = new Date().toISOString();

    const response = await app.inject({
      method: "POST",
      url: "/api/ai/events/financial-drafts",
      payload,
      headers: {
        "content-type": "application/json",
        "x-initi-timestamp": timestamp,
        "x-initi-signature": signPayload(payload, timestamp),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().mode).toBe("duplicate");
  });

  it("rejects bad signature", async () => {
    const payload = JSON.stringify({
      eventId: "evt-bad-signature",
      occurredAt: new Date().toISOString(),
      source: { channel: "gmail" },
      draft: {
        direction: "CONTA_PAGAR",
        partyName: "CloudPlus",
        description: "Invoice",
      },
      ai: {
        provider: "active-actions-gateway",
        confidenceScore: 82,
        rawResponse: "{\"ok\":true}",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/ai/events/financial-drafts",
      payload,
      headers: {
        "content-type": "application/json",
        "x-initi-timestamp": new Date().toISOString(),
        "x-initi-signature": "badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb",
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects stale timestamp", async () => {
    const payload = JSON.stringify({
      eventId: "evt-stale",
      occurredAt: new Date().toISOString(),
      source: { channel: "gmail" },
      draft: {
        direction: "CONTA_PAGAR",
        partyName: "CloudPlus",
        description: "Invoice",
      },
      ai: {
        provider: "active-actions-gateway",
        confidenceScore: 82,
        rawResponse: "{\"ok\":true}",
      },
    });
    const timestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const response = await app.inject({
      method: "POST",
      url: "/api/ai/events/financial-drafts",
      payload,
      headers: {
        "content-type": "application/json",
        "x-initi-timestamp": timestamp,
        "x-initi-signature": signPayload(payload, timestamp),
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects invalid payload before persistence", async () => {
    const payload = JSON.stringify({
      eventId: "evt-invalid",
      occurredAt: new Date().toISOString(),
      source: { channel: "gmail" },
      draft: {
        direction: "CONTA_PAGAR",
        description: "Invoice without party name",
      },
      ai: {
        provider: "active-actions-gateway",
        confidenceScore: 82,
        rawResponse: "{\"ok\":true}",
      },
    });
    const timestamp = new Date().toISOString();

    const response = await app.inject({
      method: "POST",
      url: "/api/ai/events/financial-drafts",
      payload,
      headers: {
        "content-type": "application/json",
        "x-initi-timestamp": timestamp,
        "x-initi-signature": signPayload(payload, timestamp),
      },
    });

    expect(response.statusCode).toBe(400);
    expect(aiDraftServiceMock.ingestExternalNormalizedDraft).not.toHaveBeenCalled();
  });

  it("keeps only legacy webhook route disabled", async () => {
    const webhookResponse = await app.inject({
      method: "POST",
      url: "/api/webhooks/invoices",
    });
    const mailboxResponse = await app.inject({
      method: "GET",
      url: "/api/mailboxes",
    });
    const inboxResponse = await app.inject({
      method: "GET",
      url: "/api/inbox/emails",
    });

    expect(webhookResponse.statusCode).toBe(410);
    expect(mailboxResponse.statusCode).toBe(401);
    expect(inboxResponse.statusCode).toBe(401);
  });
});
