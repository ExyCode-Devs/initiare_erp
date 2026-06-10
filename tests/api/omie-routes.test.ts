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
    findFirstOrThrow: vi.fn()
  }
};

const listOmieConnectionsMock = vi.fn();
const saveOmieConnectionMock = vi.fn();
const resolveOmieConnectionMock = vi.fn();
const markOmieConnectionHealthMock = vi.fn();
const syncOmieCatalogsMock = vi.fn();
const exportDraftToOmieMock = vi.fn();
const listCategoriesMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../../api/src/lib/omie-connections.js", () => ({
  listOmieConnections: listOmieConnectionsMock,
  saveOmieConnection: saveOmieConnectionMock,
  resolveOmieConnection: resolveOmieConnectionMock,
  markOmieConnectionHealth: markOmieConnectionHealthMock
}));

vi.mock("../../api/src/lib/omie-catalog-sync-service.js", () => ({
  syncOmieCatalogs: syncOmieCatalogsMock
}));

vi.mock("../../api/src/lib/omie-export-service.js", () => ({
  exportDraftToOmie: exportDraftToOmieMock
}));

vi.mock("../../api/src/lib/omie-client.js", () => ({
  OmieClient: class {
    listCategories = listCategoriesMock;
  }
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

async function login(app: FastifyInstance) {
  const { hashPassword } = await import("../../api/src/lib/auth.ts");
  prismaMock.user.findUnique.mockResolvedValue({
    id: "user-1",
    name: "Admin User",
    email: "admin@example.com",
    passwordHash: await hashPassword("ChangeMe123!"),
    role: "ADMIN",
    companyId: "company-1",
    company: {
      id: "company-1",
      name: "Initiare",
      domain: "localhost"
    }
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: "admin@example.com",
      password: "ChangeMe123!"
    }
  });

  return response.json().token as string;
}

describe("omie routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lists OMIE settings", async () => {
    listOmieConnectionsMock.mockResolvedValue([
      {
        id: "conn-1",
        provider: "OMIE",
        environment: "HOMOLOG",
        baseUrl: "https://app.omie.com.br/api/v1",
        enabled: true,
        hasAppKey: true,
        hasAppSecret: true,
        lastSyncAt: null,
        lastHealthcheckAt: null,
        lastHealthcheckStatus: "UNKNOWN",
        lastError: null
      }
    ]);
    const token = await login(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/settings/integrations/omie",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().provider).toBe("OMIE");
  });

  it("tests connection and syncs categories", async () => {
    resolveOmieConnectionMock.mockResolvedValue({
      id: "conn-1",
      environment: "HOMOLOG",
      baseUrl: "https://app.omie.com.br/api/v1",
      appKey: "key",
      appSecret: "secret"
    });
    listCategoriesMock.mockResolvedValue({
      categoria_cadastro: [{ codigo: "2.04.01" }]
    });
    const token = await login(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/settings/integrations/omie/HOMOLOG/test",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        legalEntityId: "legal-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(markOmieConnectionHealthMock).toHaveBeenCalled();
  });

  it("exports draft and returns OMIE history", async () => {
    exportDraftToOmieMock.mockResolvedValue({
      draftId: "draft-1",
      environment: "HOMOLOG",
      status: "SUCCESS",
      externalId: "3846660524"
    });
    prismaMock.financialDraft.findFirstOrThrow.mockResolvedValue({
      id: "draft-1",
      erpSyncRecords: [
        {
          id: "sync-1",
          entityType: "ACCOUNT_PAYABLE",
          environment: "HOMOLOG",
          status: "SUCCESS",
          externalId: "3846660524",
          errorMessage: null,
          syncedAt: new Date("2026-06-08T10:00:00Z"),
          createdAt: new Date("2026-06-08T10:00:00Z")
        }
      ],
      erpRequestLogs: [
        {
          id: "req-1",
          endpoint: "https://app.omie.com.br/api/v1/financas/contapagar/",
          method: "POST",
          httpStatus: 200,
          operationStatus: "SUCCESS",
          friendlyError: null,
          technicalError: null,
          createdAt: new Date("2026-06-08T10:00:00Z")
        }
      ]
    });
    const token = await login(app);

    const exportResponse = await app.inject({
      method: "POST",
      url: "/api/financial-drafts/draft-1/omie-export",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        environment: "HOMOLOG"
      }
    });

    const historyResponse = await app.inject({
      method: "GET",
      url: "/api/financial-drafts/draft-1/omie-history",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(exportResponse.statusCode).toBe(200);
    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.json().syncs).toHaveLength(1);
  });
});
