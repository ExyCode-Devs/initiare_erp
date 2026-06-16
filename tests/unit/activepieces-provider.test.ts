import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

function applyBaseEnv() {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test";
  process.env.JWT_SECRET = "12345678901234567890123456789012";
  process.env.APP_ORIGIN = "http://localhost:8080";
  process.env.ACTIVE_ACTIONS_HMAC_SECRET = "active-actions-secret-123456789012";
}

describe("activepieces-provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubGlobal("fetch", fetchMock);
    applyBaseEnv();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ACTIVEPIECES_EXTRACTION_WEBHOOK_URL;
    delete process.env.ACTIVEPIECES_EXTRACTION_AUTH_MODE;
    delete process.env.ACTIVEPIECES_EXTRACTION_BEARER_TOKEN;
    delete process.env.ACTIVEPIECES_EXTRACTION_HMAC_SECRET;
    delete process.env.ACTIVEPIECES_EXTRACTION_HMAC_HEADER;
  });

  it("sends bearer token when configured", async () => {
    process.env.ACTIVEPIECES_EXTRACTION_WEBHOOK_URL = "https://example.com/webhook";
    process.env.ACTIVEPIECES_EXTRACTION_AUTH_MODE = "bearer";
    process.env.ACTIVEPIECES_EXTRACTION_BEARER_TOKEN = "token-123";
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          type: "conta_pagar",
          partyName: "Fornecedor XPTO",
          description: "Fatura junho"
        })
    });

    const { dispatchActivepiecesExtraction } = await import("../../api/src/lib/activepieces-provider.ts");

    await dispatchActivepiecesExtraction({
      extractionRunId: "run-1",
      payload: {
        company: {
          id: "company-1",
          name: "Initiare",
          domain: "initiare.local"
        },
        email: {
          id: "email-1",
          sender: "billing@example.com",
          recipients: ["finance@example.com"],
          subject: "Invoice",
          bodyText: "Body",
          receivedAt: "2026-06-15T12:00:00.000Z"
        },
        attachments: [],
        context: {
          knownSuppliers: [],
          knownClients: [],
          knownCategories: []
        }
      }
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer token-123",
          "content-type": "application/json"
        })
      })
    );
  });

  it("sends HMAC signature when configured", async () => {
    process.env.ACTIVEPIECES_EXTRACTION_WEBHOOK_URL = "https://example.com/webhook";
    process.env.ACTIVEPIECES_EXTRACTION_AUTH_MODE = "hmac";
    process.env.ACTIVEPIECES_EXTRACTION_HMAC_SECRET = "super-secret-hmac";
    process.env.ACTIVEPIECES_EXTRACTION_HMAC_HEADER = "x-test-signature";
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          type: "conta_receber",
          partyName: "Cliente XPTO",
          description: "Recebimento"
        })
    });

    const payload = {
      company: {
        id: "company-1",
        name: "Initiare",
        domain: "initiare.local"
      },
      email: {
        id: "email-2",
        sender: "receipts@example.com",
        recipients: ["finance@example.com"],
        subject: "Receivable",
        bodyText: "Body",
        receivedAt: "2026-06-15T12:00:00.000Z"
      },
      attachments: [],
      context: {
        knownSuppliers: [],
        knownClients: [],
        knownCategories: []
      }
    };
    const expectedSignature = createHmac("sha256", "super-secret-hmac")
      .update(JSON.stringify({ ...payload, deliveryMode: "sync" }))
      .digest("hex");
    const { dispatchActivepiecesExtraction } = await import("../../api/src/lib/activepieces-provider.ts");

    await dispatchActivepiecesExtraction({
      extractionRunId: "run-2",
      payload
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          "content-type": "application/json",
          "x-test-signature": expectedSignature
        })
      })
    );
  });
});
