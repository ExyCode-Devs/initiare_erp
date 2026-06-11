import { describe, expect, it, beforeEach, vi } from "vitest";

const prismaMock = {
  financialDraft: {
    findFirstOrThrow: vi.fn(),
    update: vi.fn()
  },
  supplier: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  client: {
    findFirst: vi.fn(),
    create: vi.fn()
  },
  accountPayable: {
    create: vi.fn()
  },
  accountReceivable: {
    create: vi.fn()
  },
  erpSyncRecord: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn()
  }
};

const touchOmieLastSyncMock = vi.fn();
const resolveOmieConnectionMock = vi.fn();
const createPartyMock = vi.fn();
const createPayableMock = vi.fn();
const createReceivableMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../../api/src/lib/omie-connections.js", () => ({
  resolveOmieConnection: resolveOmieConnectionMock,
  touchOmieLastSync: touchOmieLastSyncMock
}));

vi.mock("../../api/src/lib/omie-client.js", () => ({
  OmieClient: class {
    createParty = createPartyMock;
    createPayable = createPayableMock;
    createReceivable = createReceivableMock;
  }
}));

describe("omie-export-service", () => {
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

  it("executes approved payable draft, creates supplier mapping, and mirrors local payable after OMIE success", async () => {
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
      bankData: { omieCurrentAccountId: "3731356020" },
      rawPayload: {
        _workflow: {
          execution: {
            status: "queued",
            environment: "HOMOLOG",
            retryCount: 0
          }
        }
      },
      confidenceScore: 88,
      paymentMethod: "Boleto",
      resultingResourceId: null,
      resultingResourceType: null
    });
    prismaMock.erpSyncRecord.findUnique.mockResolvedValue(null);
    prismaMock.erpSyncRecord.findMany.mockResolvedValue([
      { entityType: "CATEGORY", internalId: "category-1", externalId: "2.04.01", requestPayload: { descricao: "Infraestrutura" }, responsePayload: {} },
      { entityType: "CURRENT_ACCOUNT", internalId: "current-account:3731356020", externalId: "3731356020", requestPayload: {}, responsePayload: {} }
    ]);
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    prismaMock.supplier.create.mockResolvedValue({ id: "supplier-1" });
    createPartyMock.mockResolvedValue({
      codigo_cliente_omie: 3795260786,
      codigo_status: "0"
    });
    createPayableMock.mockResolvedValue({
      codigo_status: "0",
      codigo_lancamento_omie: 3846660524
    });
    prismaMock.accountPayable.create.mockResolvedValue({ id: "payable-1" });
    prismaMock.erpSyncRecord.upsert.mockResolvedValue({ id: "sync-1", status: "SUCCESS", externalId: "3846660524" });
    prismaMock.financialDraft.update.mockResolvedValue({ id: "draft-1", status: "APROVADO" });

    const { runApprovedDraftExecution } = await import("../../api/src/lib/omie-export-service.js");
    const result = await runApprovedDraftExecution({
      companyId: "company-1",
      draftId: "draft-1",
      environment: "HOMOLOG",
      triggeredByUserId: "user-1"
    });

    expect(result.status).toBe("success");
    expect(createPartyMock).toHaveBeenCalledOnce();
    expect(createPayableMock).toHaveBeenCalledOnce();
    expect(prismaMock.accountPayable.create).toHaveBeenCalledOnce();
    expect(touchOmieLastSyncMock).toHaveBeenCalledOnce();
  }, 15000);

  it("returns integration error and leaves retryable state when provider fails", async () => {
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-2",
      companyId: "company-1",
      legalEntityId: "legal-1",
      status: "APROVADO",
      direction: "CONTA_RECEBER",
      partyName: "Client A",
      cpfCnpj: null,
      amount: 150,
      dueDate: new Date("2026-06-12"),
      description: "Mensalidade",
      notes: null,
      finalCategory: "Receita",
      suggestedCategory: "Receita",
      bankData: { omieCurrentAccountId: "3731356020" },
      rawPayload: {
        _workflow: {
          execution: {
            status: "queued",
            environment: "HOMOLOG",
            retryCount: 0
          }
        }
      },
      confidenceScore: 77,
      paymentMethod: "Pix",
      resultingResourceId: null,
      resultingResourceType: null
    });
    prismaMock.erpSyncRecord.findUnique.mockResolvedValue(null);
    prismaMock.erpSyncRecord.findMany.mockResolvedValue([
      { entityType: "CATEGORY", internalId: "category-1", externalId: "3.01.01", requestPayload: { descricao: "Receita" }, responsePayload: {} },
      { entityType: "CURRENT_ACCOUNT", internalId: "current-account:3731356020", externalId: "3731356020", requestPayload: {}, responsePayload: {} }
    ]);
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1", name: "Client A" });
    createPartyMock.mockResolvedValue({
      codigo_cliente_omie: 111,
      codigo_status: "0"
    });
    createReceivableMock.mockRejectedValue(new Error("OMIE timeout"));
    prismaMock.erpSyncRecord.upsert.mockResolvedValue({ id: "sync-2", status: "ERROR", externalId: null });
    prismaMock.financialDraft.update.mockResolvedValue({ id: "draft-2", status: "APROVADO" });

    const { runApprovedDraftExecution } = await import("../../api/src/lib/omie-export-service.js");
    const result = await runApprovedDraftExecution({
      companyId: "company-1",
      draftId: "draft-2",
      environment: "HOMOLOG",
      triggeredByUserId: "user-1"
    });

    expect(result.status).toBe("error");
    expect(prismaMock.accountReceivable.create).not.toHaveBeenCalled();
    expect(prismaMock.erpSyncRecord.upsert).toHaveBeenCalled();
  });

  it("retries only failed approved drafts", async () => {
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-3",
      companyId: "company-1",
      status: "APROVADO",
      rawPayload: {
        _workflow: {
          execution: {
            status: "queued"
          }
        }
      }
    });

    const { retryDraftExecution } = await import("../../api/src/lib/omie-export-service.js");

    await expect(
      retryDraftExecution({
        companyId: "company-1",
        draftId: "draft-3",
        environment: "HOMOLOG",
        triggeredByUserId: "user-1"
      })
    ).rejects.toThrow("Only failed approved drafts can be retried.");
  });
});
