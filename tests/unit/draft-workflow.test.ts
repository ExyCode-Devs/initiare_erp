import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  financialDraft: {
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
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

  it("approves payable draft and queues execution without local mirror creation", async () => {
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
      description: "Monthly invoice",
      legalEntityId: "legal-1",
      routingStatus: "ROUTED",
      routingReason: null,
      evidence: ["invoice.pdf"],
      rawPayload: {},
      confidenceScore: 88,
      sourceEmailId: "email-1",
    });
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
    expect(prismaMock.accountPayable.create).not.toHaveBeenCalled();
    expect(prismaMock.inboundEmail.update).toHaveBeenCalledOnce();
    expect(writeAuditLogMock).toHaveBeenCalledOnce();
    expect(prismaMock.financialDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resultingResourceId: null,
          resultingResourceType: null
        })
      })
    );
  });

  it("blocks approval when required review fields are missing", async () => {
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-blocked",
      companyId: "company-1",
      status: "PENDENTE_REVISAO",
      direction: "CONTA_PAGAR",
      partyName: "CloudPlus",
      finalCategory: null,
      suggestedCategory: null,
      amount: null,
      dueDate: null,
      description: "",
      legalEntityId: null,
      routingStatus: "UNROUTED",
      routingReason: "Ambiguous mailbox route for finance",
      evidence: [],
      rawPayload: {},
      sourceEmailId: null,
    });

    const { approveDraft } = await import("../../api/src/lib/draft-workflow.ts");

    await expect(
      approveDraft({
        draftId: "draft-blocked",
        companyId: "company-1",
        note: null,
        user: {
          id: "user-1",
          name: "Admin",
          email: "admin@example.com",
        },
      }),
    ).rejects.toThrow("Amount is required before approval.");

    expect(prismaMock.accountPayable.create).not.toHaveBeenCalled();
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

  it("marks and undoes duplicate state through workflow metadata", async () => {
    prismaMock.financialDraft.findFirstOrThrow
      .mockResolvedValueOnce({
        id: "draft-1",
        companyId: "company-1",
        status: "PENDENTE_REVISAO",
        rawPayload: {},
      })
      .mockResolvedValueOnce({
        id: "draft-2",
        companyId: "company-1",
        status: "PENDENTE_REVISAO",
        rawPayload: {},
      })
      .mockResolvedValueOnce({
        id: "draft-1",
        companyId: "company-1",
        status: "REJEITADO",
        rawPayload: {
          _workflow: {
            reviewState: "duplicated",
            duplicateOfId: "draft-2",
          },
        },
      });
    prismaMock.financialDraft.update
      .mockResolvedValueOnce({ id: "draft-1", status: "REJEITADO" })
      .mockResolvedValueOnce({ id: "draft-1", status: "PENDENTE_REVISAO" });

    const { markDraftAsDuplicate, undoDraftDuplicate } = await import("../../api/src/lib/draft-workflow.ts");

    const duplicated = await markDraftAsDuplicate({
      draftId: "draft-1",
      companyId: "company-1",
      duplicateOfId: "draft-2",
      note: "Same invoice",
      user: {
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
      },
    });
    const restored = await undoDraftDuplicate({
      draftId: "draft-1",
      companyId: "company-1",
      user: {
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
      },
    });

    expect(duplicated).toEqual({ id: "draft-1", status: "REJEITADO" });
    expect(restored).toEqual({ id: "draft-1", status: "PENDENTE_REVISAO" });
    expect(writeAuditLogMock).toHaveBeenCalledTimes(2);
  });

  it("scores duplicate candidates inside same tenant", async () => {
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-1",
      companyId: "company-1",
      direction: "CONTA_PAGAR",
      partyName: "CloudPlus",
      cpfCnpj: "11.222.333/0001-44",
      amount: 100,
      dueDate: new Date("2026-06-12"),
      description: "Monthly invoice",
    });
    prismaMock.financialDraft.findMany.mockResolvedValue([
      {
        id: "draft-2",
        partyName: "CloudPlus",
        cpfCnpj: "11.222.333/0001-44",
        amount: 100,
        dueDate: new Date("2026-06-12"),
        description: "Monthly invoice",
        status: "PENDENTE_REVISAO",
      },
      {
        id: "draft-3",
        partyName: "Other supplier",
        cpfCnpj: null,
        amount: 100,
        dueDate: null,
        description: "Different",
        status: "PENDENTE_REVISAO",
      },
    ]);

    const { listDraftDuplicateCandidates } = await import("../../api/src/lib/draft-workflow.ts");
    const candidates = await listDraftDuplicateCandidates({
      draftId: "draft-1",
      companyId: "company-1",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.id).toBe("draft-2");
    expect(candidates[0]?.score).toBeGreaterThanOrEqual(4);
  });
});
