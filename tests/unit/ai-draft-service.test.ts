import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = {
  aiEventSource: {
    create: vi.fn(),
    update: vi.fn(),
  },
  aiGatewayRun: {
    create: vi.fn(),
    update: vi.fn(),
  },
  financialDraft: {
    create: vi.fn(),
  },
};

const prismaMock = {
  company: {
    findFirstOrThrow: vi.fn(),
  },
  aiEventSource: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  aiGatewayRun: {
    create: vi.fn(),
    update: vi.fn(),
  },
  financialDraft: {
    create: vi.fn(),
  },
  exceptionItem: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

const writeAuditLogMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../../api/src/lib/audit.js", () => ({
  writeAuditLog: writeAuditLogMock,
}));

describe("ai-draft-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
  });

  it("ingests external normalized draft and persists event, run, and draft", async () => {
    prismaMock.aiEventSource.findUnique.mockResolvedValue(null);
    txMock.aiEventSource.create.mockResolvedValue({ id: "event-1" });
    txMock.aiGatewayRun.create.mockResolvedValue({ id: "run-1" });
    txMock.financialDraft.create.mockResolvedValue({ id: "draft-1" });
    txMock.aiEventSource.update.mockResolvedValue({ id: "event-1" });

    const { ingestExternalNormalizedDraft } = await import("../../api/src/lib/ai-draft-service.ts");

    const result = await ingestExternalNormalizedDraft({
      companyId: "company-1",
      eventId: "evt-1",
      occurredAt: "2026-06-03T09:00:00.000Z",
      originType: "ACTIVE_ACTIONS",
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
        amount: 100,
      },
      ai: {
        provider: "active-actions-gateway",
        confidenceScore: 89,
        rawResponse: "{\"ok\":true}",
      },
      rawPayload: {
        eventId: "evt-1",
      },
    });

    expect(result).toEqual({
      mode: "created",
      eventSourceId: "event-1",
      aiRunId: "run-1",
      draftId: "draft-1",
    });
    expect(txMock.aiEventSource.create).toHaveBeenCalledOnce();
    expect(txMock.aiGatewayRun.create).toHaveBeenCalledOnce();
    expect(txMock.financialDraft.create).toHaveBeenCalledOnce();
    expect(writeAuditLogMock).toHaveBeenCalledOnce();
  });

  it("runs internal generation and persists success through same path", async () => {
    prismaMock.aiEventSource.create.mockResolvedValue({ id: "event-2" });
    prismaMock.aiGatewayRun.create.mockResolvedValue({ id: "run-2" });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => {
      txMock.aiGatewayRun.update.mockResolvedValue({ id: "run-2" });
      txMock.financialDraft.create.mockResolvedValue({ id: "draft-2" });
      txMock.aiEventSource.update.mockResolvedValue({ id: "event-2" });
      return callback(txMock);
    });

    const { runInternalDraftGeneration } = await import("../../api/src/lib/ai-draft-service.ts");

    const result = await runInternalDraftGeneration({
      companyId: "company-1",
      eventId: "internal-evt-1",
      source: {
        channel: "manual-review",
        summary: "Need payable enrichment",
      },
      requestPayload: {
        action: "manual-review",
      },
      failureContext: {
        actionLabel: "manual review",
        entityLabel: "Draft CloudPlus",
        entityId: "draft-raw-1",
      },
      invokeAi: async () => ({
        draft: {
          direction: "CONTA_PAGAR",
          partyName: "CloudPlus",
          description: "Monthly invoice",
          amount: 150,
        },
        ai: {
          provider: "internal-ai",
          confidenceScore: 81,
          rawResponse: "{\"ok\":true}",
        },
      }),
      user: {
        id: "user-1",
        name: "Admin",
        email: "admin@example.com",
      },
    });

    expect(result).toEqual({
      mode: "created",
      eventSourceId: "event-2",
      aiRunId: "run-2",
      draftId: "draft-2",
    });
    expect(txMock.aiGatewayRun.update).toHaveBeenCalledOnce();
    expect(txMock.financialDraft.create).toHaveBeenCalledOnce();
  });

  it("records internal AI failure and creates exception item", async () => {
    prismaMock.aiEventSource.create.mockResolvedValue({ id: "event-3" });
    prismaMock.aiGatewayRun.create.mockResolvedValue({ id: "run-3" });
    prismaMock.aiGatewayRun.update.mockResolvedValue({ id: "run-3" });
    prismaMock.aiEventSource.update.mockResolvedValue({ id: "event-3" });
    prismaMock.exceptionItem.create.mockResolvedValue({ id: "exception-1" });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock as never));

    const { runInternalDraftGeneration } = await import("../../api/src/lib/ai-draft-service.ts");

    const result = await runInternalDraftGeneration({
      companyId: "company-1",
      eventId: "internal-evt-2",
      source: {
        channel: "manual-review",
        summary: "Need receivable enrichment",
      },
      requestPayload: {
        action: "manual-review",
      },
      failureContext: {
        actionLabel: "manual review",
        entityLabel: "Draft Globex",
        entityId: "draft-raw-2",
      },
      invokeAi: async () => {
        throw new Error("provider timeout");
      },
    });

    expect(result).toEqual({
      mode: "failed",
      eventSourceId: "event-3",
      aiRunId: "run-3",
      draftId: null,
      error: "provider timeout",
    });
    expect(prismaMock.exceptionItem.create).toHaveBeenCalledOnce();
    expect(writeAuditLogMock).toHaveBeenCalled();
  });
});
