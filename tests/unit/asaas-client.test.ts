import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn();

vi.mock("../../api/src/lib/asaas-audit-service.ts", () => ({
  recordAsaasRequestLog: auditMock
}));

describe("asaas-client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("logs success without exposing access token", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ data: [] }))
    }) as typeof fetch;

    const { AsaasClient } = await import("../../api/src/lib/asaas-client.ts");
    const client = new AsaasClient({
      id: "conn-1",
      provider: "ASAAS",
      environment: "SANDBOX",
      appKeyCipher: null,
      appSecretCipher: null,
      webhookAuthTokenCipher: null,
      baseUrl: "https://api-sandbox.asaas.com/v3",
      enabled: true,
      lastSyncAt: null,
      lastHealthcheckAt: null,
      lastHealthcheckStatus: "UNKNOWN",
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      companyId: "company-1",
      apiKey: "$aact_hmlg_secret",
      webhookAuthToken: "whsec_secret"
    });

    await client.listCustomers({
      companyId: "company-1",
      connectionId: "conn-1",
      triggeredByUserId: "user-1"
    });

    expect(auditMock).toHaveBeenCalledOnce();
    expect(JSON.stringify(auditMock.mock.calls[0][0])).not.toContain("$aact_hmlg_secret");
  });

  it("retries one transient network failure", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ data: [] }))
      }) as typeof fetch;

    const { AsaasClient } = await import("../../api/src/lib/asaas-client.ts");
    const client = new AsaasClient({
      id: "conn-1",
      provider: "ASAAS",
      environment: "SANDBOX",
      appKeyCipher: null,
      appSecretCipher: null,
      webhookAuthTokenCipher: null,
      baseUrl: "https://api-sandbox.asaas.com/v3",
      enabled: true,
      lastSyncAt: null,
      lastHealthcheckAt: null,
      lastHealthcheckStatus: "UNKNOWN",
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      companyId: "company-1",
      apiKey: "$aact_hmlg_secret",
      webhookAuthToken: "whsec_secret"
    });

    await client.listPayments({
      companyId: "company-1",
      connectionId: "conn-1",
      triggeredByUserId: "user-1"
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
