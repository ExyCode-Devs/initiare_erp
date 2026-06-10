import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $queryRaw: vi.fn(),
  user: {
    findUnique: vi.fn()
  },
  auditLog: {
    create: vi.fn()
  },
  financialDraft: {
    findMany: vi.fn(),
    findFirstOrThrow: vi.fn()
  }
};

const approveDraftMock = vi.fn();
const getDraftApprovalBlockersMock = vi.fn();
const getDraftWorkflowStatusMock = vi.fn();
const listDraftDuplicateCandidatesMock = vi.fn();
const markDraftAsDuplicateMock = vi.fn();
const patchDraftFieldsMock = vi.fn();
const rejectDraftMock = vi.fn();
const requestDraftReprocessMock = vi.fn();
const undoDraftDuplicateMock = vi.fn();
const getLegalEntityOrThrowMock = vi.fn();
const exportDraftToOmieMock = vi.fn();
const retryDraftExecutionMock = vi.fn();
const runApprovedDraftExecutionMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../../api/src/lib/draft-workflow.js", () => ({
  approveDraft: approveDraftMock,
  getDraftApprovalBlockers: getDraftApprovalBlockersMock,
  getDraftWorkflowStatus: getDraftWorkflowStatusMock,
  listDraftDuplicateCandidates: listDraftDuplicateCandidatesMock,
  markDraftAsDuplicate: markDraftAsDuplicateMock,
  patchDraftFields: patchDraftFieldsMock,
  rejectDraft: rejectDraftMock
  ,
  requestDraftReprocess: requestDraftReprocessMock,
  undoDraftDuplicate: undoDraftDuplicateMock
}));

vi.mock("../../api/src/lib/legal-entities.js", () => ({
  getLegalEntityOrThrow: getLegalEntityOrThrowMock
}));

vi.mock("../../api/src/lib/omie-export-service.js", () => ({
  exportDraftToOmie: exportDraftToOmieMock,
  retryDraftExecution: retryDraftExecutionMock,
  runApprovedDraftExecution: runApprovedDraftExecutionMock
}));

async function buildTestApp() {
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test";
  process.env.JWT_SECRET = "12345678901234567890123456789012";
  process.env.APP_ORIGIN = "http://localhost:8080";
  process.env.ACTIVE_ACTIONS_HMAC_SECRET = "active-actions-secret-123456789012";
  process.env.NODE_ENV = "test";

  const { buildApp } = await import("../../api/src/app.ts");
  return buildApp();
}

async function loginAs(
  app: FastifyInstance,
  options: {
    role: "ADMIN" | "ANALYST" | "VIEWER";
    companyId: string;
  }
) {
  const { hashPassword } = await import("../../api/src/lib/auth.ts");
  prismaMock.user.findUnique.mockResolvedValue({
    id: "user-1",
    name: "User",
    email: "user@example.com",
    passwordHash: await hashPassword("ChangeMe123!"),
    role: options.role,
    companyId: options.companyId,
    company: {
      id: options.companyId,
      name: "Initiare",
      domain: "localhost"
    }
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: "user@example.com",
      password: "ChangeMe123!"
    }
  });

  return response.json().token as string;
}

describe("financial draft routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    getDraftApprovalBlockersMock.mockReturnValue([]);
    getDraftWorkflowStatusMock.mockReturnValue("pending_review");
    listDraftDuplicateCandidatesMock.mockResolvedValue([]);
    runApprovedDraftExecutionMock.mockResolvedValue({
      draftId: "draft-1",
      status: "success",
      provider: "OMIE",
      environment: "HOMOLOG",
      externalId: "omie-1"
    });
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lists drafts scoped to the authenticated company", async () => {
    prismaMock.financialDraft.findMany.mockResolvedValue([]);
    const token = await loginAs(app, { role: "VIEWER", companyId: "company-1" });

    const response = await app.inject({
      method: "GET",
      url: "/api/financial-drafts",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.financialDraft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-1"
        })
      })
    );
  });

  it("blocks viewer export actions", async () => {
    const token = await loginAs(app, { role: "VIEWER", companyId: "company-1" });

    const response = await app.inject({
      method: "POST",
      url: "/api/financial-drafts/draft-1/omie-export",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        environment: "HOMOLOG"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(exportDraftToOmieMock).not.toHaveBeenCalled();
  });

  it("checks company ownership before returning OMIE history", async () => {
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-1",
      erpSyncRecords: [],
      erpRequestLogs: []
    });
    const token = await loginAs(app, { role: "ANALYST", companyId: "company-1" });

    const response = await app.inject({
      method: "GET",
      url: "/api/financial-drafts/draft-1/omie-history",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.financialDraft.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "draft-1",
          companyId: "company-1"
        })
      })
    );
  });

  it("blocks approval when workflow blockers exist", async () => {
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-1",
      companyId: "company-1"
    });
    getDraftApprovalBlockersMock.mockReturnValue([
      {
        code: "missing_amount",
        message: "Amount is required before approval."
      }
    ]);
    const token = await loginAs(app, { role: "ANALYST", companyId: "company-1" });

    const response = await app.inject({
      method: "POST",
      url: "/api/financial-drafts/draft-1/approve",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {}
    });

    expect(response.statusCode).toBe(409);
    expect(approveDraftMock).not.toHaveBeenCalled();
  });

  it("approves and sends draft to execution flow", async () => {
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-1",
      companyId: "company-1"
    });
    approveDraftMock.mockResolvedValue({
      id: "draft-1",
      status: "APROVADO"
    });
    const token = await loginAs(app, { role: "ANALYST", companyId: "company-1" });

    const response = await app.inject({
      method: "POST",
      url: "/api/financial-drafts/draft-1/approve",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {}
    });

    expect(response.statusCode).toBe(200);
    expect(approveDraftMock).toHaveBeenCalledWith(expect.objectContaining({ environment: "HOMOLOG" }));
    expect(runApprovedDraftExecutionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: "draft-1",
        companyId: "company-1",
        environment: "HOMOLOG"
      })
    );
  });

  it("marks duplicate through explicit review action", async () => {
    markDraftAsDuplicateMock.mockResolvedValue({
      id: "draft-1",
      status: "REJEITADO"
    });
    const token = await loginAs(app, { role: "ANALYST", companyId: "company-1" });

    const response = await app.inject({
      method: "POST",
      url: "/api/financial-drafts/draft-1/mark-duplicate",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        duplicateOfId: "draft-2",
        note: "Same invoice"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(markDraftAsDuplicateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: "draft-1",
        duplicateOfId: "draft-2",
        companyId: "company-1"
      })
    );
  });

  it("requests AI reprocess through explicit review action", async () => {
    requestDraftReprocessMock.mockResolvedValue({
      id: "draft-1",
      status: "PENDENTE_REVISAO"
    });
    const token = await loginAs(app, { role: "ADMIN", companyId: "company-1" });

    const response = await app.inject({
      method: "POST",
      url: "/api/financial-drafts/draft-1/request-reprocess",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        note: "Low confidence"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(requestDraftReprocessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: "draft-1",
        companyId: "company-1",
        note: "Low confidence"
      })
    );
  });

  it("retries execution only through explicit review action", async () => {
    retryDraftExecutionMock.mockResolvedValue({
      draftId: "draft-1",
      status: "success",
      provider: "OMIE",
      environment: "HOMOLOG",
      externalId: "omie-2"
    });
    const token = await loginAs(app, { role: "ADMIN", companyId: "company-1" });

    const response = await app.inject({
      method: "POST",
      url: "/api/financial-drafts/draft-1/retry-execution",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {}
    });

    expect(response.statusCode).toBe(200);
    expect(retryDraftExecutionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: "draft-1",
        companyId: "company-1",
        environment: "HOMOLOG"
      })
    );
  });
});
