import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  financialDraft: {
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
  },
  supplier: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  accountPayable: {
    create: vi.fn(),
  },
  accountReceivable: {
    create: vi.fn(),
  },
  inboundEmail: {
    update: vi.fn(),
  },
  financialDraftReview: {
    create: vi.fn(),
  },
};

const writeAuditLogMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../../api/src/lib/audit.js", () => ({
  writeAuditLog: writeAuditLogMock,
}));

describe("draft-workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("approves payable draft and creates account payable", async () => {
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-1",
      companyId: "company-1",
      status: "PENDENTE_REVISAO",
      direction: "CONTA_PAGAR",
      partyName: "CloudPlus",
      cpfCnpj: "11.222.333/0001-44",
      finalCategory: "Infraestrutura",
      suggestedCategory: "Infraestrutura",
      amount: 100,
      dueDate: new Date("2026-06-12"),
      confidenceScore: 88,
      sourceEmailId: "email-1",
    });
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    prismaMock.supplier.create.mockResolvedValue({ id: "supplier-1" });
    prismaMock.accountPayable.create.mockResolvedValue({ id: "payable-1" });
    prismaMock.financialDraft.update.mockResolvedValue({ id: "draft-1", status: "APROVADO" });
    prismaMock.inboundEmail.update.mockResolvedValue({ id: "email-1" });
    prismaMock.financialDraftReview.create.mockResolvedValue({ id: "review-1" });

    const { approveDraft } = await import("../../api/src/lib/draft-workflow.ts");

    const result = await approveDraft({
      draftId: "draft-1",
      companyId: "company-1",
      note: "Looks good",
      user: {
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
      },
    });

    expect(result).toEqual({ id: "draft-1", status: "APROVADO" });
    expect(prismaMock.accountPayable.create).toHaveBeenCalledOnce();
    expect(prismaMock.inboundEmail.update).toHaveBeenCalledOnce();
    expect(writeAuditLogMock).toHaveBeenCalledOnce();
  });

  it("rejects draft without touching legacy email when sourceEmailId is missing", async () => {
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-2",
      companyId: "company-1",
      status: "PENDENTE_REVISAO",
      sourceEmailId: null,
    });
    prismaMock.financialDraft.update.mockResolvedValue({ id: "draft-2", status: "REJEITADO" });
    prismaMock.financialDraftReview.create.mockResolvedValue({ id: "review-2" });

    const { rejectDraft } = await import("../../api/src/lib/draft-workflow.ts");

    const result = await rejectDraft({
      draftId: "draft-2",
      companyId: "company-1",
      reason: "Need manual follow-up",
      user: {
        id: "user-2",
        name: "Analyst",
        email: "analyst@example.com",
      },
    });

    expect(result).toEqual({ id: "draft-2", status: "REJEITADO" });
    expect(prismaMock.inboundEmail.update).not.toHaveBeenCalled();
    expect(writeAuditLogMock).toHaveBeenCalledOnce();
  });
});
