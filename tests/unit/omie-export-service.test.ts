import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  financialDraft: {
    findFirstOrThrow: vi.fn()
  },
  supplier: {
    findMany: vi.fn()
  },
  client: {
    findMany: vi.fn()
  },
  erpSyncRecord: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn()
  }
};

const touchOmieLastSyncMock = vi.fn();
const resolveOmieConnectionMock = vi.fn();
const createPayableMock = vi.fn();
const recordOmieRequestLogMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../../api/src/lib/omie-connections.js", () => ({
  resolveOmieConnection: resolveOmieConnectionMock,
  touchOmieLastSync: touchOmieLastSyncMock
}));

vi.mock("../../api/src/lib/omie-audit-service.js", () => ({
  recordOmieRequestLog: recordOmieRequestLogMock
}));

vi.mock("../../api/src/lib/omie-client.js", () => ({
  OmieClient: class {
    createPayable = createPayableMock;
    createReceivable = vi.fn();
  }
}));

describe("omie-export-service", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    resolveOmieConnectionMock.mockResolvedValue({
      id: "conn-1",
      provider: "OMIE",
      environment: "HOMOLOG",
      baseUrl: "https://app.omie.com.br/api/v1",
      enabled: true,
      companyId: "company-1",
      appKey: "key",
      appSecret: "secret"
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("exports approved payable draft and persists sync record", async () => {
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-1",
      companyId: "company-1",
      legalEntityId: "legal-1",
      status: "APROVADO",
      direction: "CONTA_PAGAR",
      partyName: "CloudPlus",
      cpfCnpj: "11.222.333/0001-44",
      amount: 100,
      dueDate: new Date("2026-06-12"),
      description: "Monthly invoice",
      notes: null,
      finalCategory: "Infraestrutura",
      suggestedCategory: "Infraestrutura",
      bankData: { omieCurrentAccountId: "3731356020" }
    });
    prismaMock.erpSyncRecord.findUnique.mockResolvedValue(null);
    prismaMock.supplier.findMany.mockResolvedValue([{ id: "supplier-1", name: "CloudPlus", cnpj: "11.222.333/0001-44" }]);
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.erpSyncRecord.findMany.mockResolvedValue([
      { entityType: "SUPPLIER", internalId: "supplier-1", externalId: "3795260786", requestPayload: {}, responsePayload: {} },
      { entityType: "CATEGORY", internalId: "category-1", externalId: "2.04.01", requestPayload: { descricao: "Infraestrutura" }, responsePayload: {} },
      { entityType: "CURRENT_ACCOUNT", internalId: "current-account:3731356020", externalId: "3731356020", requestPayload: {}, responsePayload: {} }
    ]);
    createPayableMock.mockResolvedValue({
      codigo_status: "0",
      codigo_lancamento_omie: 3846660524
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ codigo_status: "0", codigo_lancamento_omie: 3846660524 }))
    }) as typeof fetch;
    prismaMock.erpSyncRecord.upsert.mockResolvedValue({
      id: "sync-1",
      status: "SUCCESS",
      externalId: "3846660524"
    });

    const { exportDraftToOmie } = await import("../../api/src/lib/omie-export-service.js");
    const result = await exportDraftToOmie({
      companyId: "company-1",
      draftId: "draft-1",
      environment: "HOMOLOG",
      triggeredByUserId: "user-1"
    });

    expect(result.externalId).toBe("3846660524");
    expect(prismaMock.erpSyncRecord.upsert).toHaveBeenCalled();
    expect(touchOmieLastSyncMock).toHaveBeenCalledOnce();
  }, 15000);

  it("blocks export when supplier is not mapped", async () => {
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-2",
      companyId: "company-1",
      legalEntityId: "legal-1",
      status: "APROVADO",
      direction: "CONTA_PAGAR",
      partyName: "Unknown supplier",
      cpfCnpj: null,
      amount: 100,
      dueDate: new Date("2026-06-12"),
      description: "Monthly invoice",
      notes: null,
      finalCategory: "Infraestrutura",
      suggestedCategory: "Infraestrutura",
      bankData: { omieCurrentAccountId: "3731356020" }
    });
    prismaMock.erpSyncRecord.findUnique.mockResolvedValue(null);
    prismaMock.supplier.findMany.mockResolvedValue([]);
    prismaMock.client.findMany.mockResolvedValue([]);
    prismaMock.erpSyncRecord.findMany.mockResolvedValue([]);
    prismaMock.erpSyncRecord.upsert.mockResolvedValue({
      id: "sync-2",
      status: "BLOCKED"
    });

    const { exportDraftToOmie } = await import("../../api/src/lib/omie-export-service.js");

    await expect(
      exportDraftToOmie({
        companyId: "company-1",
        draftId: "draft-2",
        environment: "HOMOLOG",
        triggeredByUserId: "user-1"
      })
    ).rejects.toThrow("Supplier not mapped locally for OMIE export");
  });
});
