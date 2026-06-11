import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.fn();

vi.mock("../../api/src/lib/omie-audit-service.ts", () => ({
  recordOmieRequestLog: auditMock
}));

describe("omie-client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("logs success without exposing secrets", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ codigo_status: "0", total_de_paginas: 1 }))
    }) as typeof fetch;

    const { OmieClient } = await import("../../api/src/lib/omie-client.ts");
    const client = new OmieClient({
      id: "conn-1",
      provider: "OMIE",
      environment: "HOMOLOG",
      appKeyCipher: null,
      appSecretCipher: null,
      baseUrl: "https://app.omie.com.br/api/v1",
      enabled: true,
      lastSyncAt: null,
      lastHealthcheckAt: null,
      lastHealthcheckStatus: "UNKNOWN",
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      companyId: "company-1",
      appKey: "secret-key",
      appSecret: "secret-secret"
    });

    await client.listCategories({
      companyId: "company-1",
      connectionId: "conn-1",
      triggeredByUserId: "user-1"
    });

    expect(auditMock).toHaveBeenCalledOnce();
    expect(JSON.stringify(auditMock.mock.calls[0][0])).not.toContain("secret-secret");
    expect(JSON.stringify(auditMock.mock.calls[0][0])).not.toContain("secret-key");
  });

  it("retries one transient network failure", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ codigo_status: "0", total_de_paginas: 1 }))
      }) as typeof fetch;

    const { OmieClient } = await import("../../api/src/lib/omie-client.ts");
    const client = new OmieClient({
      id: "conn-1",
      provider: "OMIE",
      environment: "HOMOLOG",
      appKeyCipher: null,
      appSecretCipher: null,
      baseUrl: "https://app.omie.com.br/api/v1",
      enabled: true,
      lastSyncAt: null,
      lastHealthcheckAt: null,
      lastHealthcheckStatus: "UNKNOWN",
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      companyId: "company-1",
      appKey: "secret-key",
      appSecret: "secret-secret"
    });

    await client.listClients({
      companyId: "company-1",
      connectionId: "conn-1",
      triggeredByUserId: "user-1"
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
