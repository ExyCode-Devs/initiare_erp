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
const patchDraftFieldsMock = vi.fn();
const rejectDraftMock = vi.fn();
const getLegalEntityOrThrowMock = vi.fn();
const exportDraftToOmieMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../../api/src/lib/draft-workflow.js", () => ({
  approveDraft: approveDraftMock,
  patchDraftFields: patchDraftFieldsMock,
  rejectDraft: rejectDraftMock
}));

vi.mock("../../api/src/lib/legal-entities.js", () => ({
  getLegalEntityOrThrow: getLegalEntityOrThrowMock
}));

vi.mock("../../api/src/lib/omie-export-service.js", () => ({
  exportDraftToOmie: exportDraftToOmieMock
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
});
