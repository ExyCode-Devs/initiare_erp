import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  erpWebhookEvent: {
    upsert: vi.fn(),
    update: vi.fn()
  }
};

const resolveAsaasConnectionMock = vi.fn();
const touchAsaasLastSyncMock = vi.fn();
const upsertAsaasPaymentFromPayloadMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../../api/src/lib/asaas-connections.js", () => ({
  resolveAsaasConnection: resolveAsaasConnectionMock,
  touchAsaasLastSync: touchAsaasLastSyncMock
}));

vi.mock("../../api/src/lib/asaas-sync-service.js", () => ({
  upsertAsaasPaymentFromPayload: upsertAsaasPaymentFromPayloadMock
}));

describe("asaas-webhook-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAsaasConnectionMock.mockResolvedValue({
      id: "conn-1",
      provider: "ASAAS",
      environment: "SANDBOX",
      baseUrl: "https://api-sandbox.asaas.com/v3",
      apiKey: "$aact_hmlg_secret",
      webhookAuthToken: "whsec_12345678901234567890123456789012"
    });
  });

  it("rejects invalid token", async () => {
    const { processAsaasWebhook } = await import("../../api/src/lib/asaas-webhook-service.ts");

    await expect(
      processAsaasWebhook({
        companyId: "company-1",
        environment: "SANDBOX",
        headers: { "asaas-access-token": "bad-token" },
        payload: { event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } }
      })
    ).rejects.toThrow("Invalid ASAAS webhook token");
  });

  it("returns early for duplicate success event", async () => {
    prismaMock.erpWebhookEvent.upsert.mockResolvedValue({
      id: "event-1",
      status: "SUCCESS"
    });

    const { processAsaasWebhook } = await import("../../api/src/lib/asaas-webhook-service.ts");
    const result = await processAsaasWebhook({
      companyId: "company-1",
      environment: "SANDBOX",
      headers: { "asaas-access-token": "whsec_12345678901234567890123456789012" },
      payload: { event: "PAYMENT_RECEIVED", payment: { id: "pay_1" } }
    });

    expect(result.status).toBe("SUCCESS");
    expect(upsertAsaasPaymentFromPayloadMock).not.toHaveBeenCalled();
  });
});
