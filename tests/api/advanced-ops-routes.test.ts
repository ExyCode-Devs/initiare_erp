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
  client: {
    findMany: vi.fn()
  },
  businessClient: {
    findMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn()
  },
  businessClientLegalEntity: {
    createMany: vi.fn()
  },
  allocationRule: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  portalAccess: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn()
  },
  legalEntity: {
    findMany: vi.fn()
  },
  accountReceivable: {
    findMany: vi.fn()
  },
  reconciliationItem: {
    findMany: vi.fn()
  },
  financialDraft: {
    findMany: vi.fn(),
    create: vi.fn()
  }
};

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
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
    memberships: [
      {
        id: `membership-${options.companyId}`,
        role: options.role,
        isDefault: true,
        companyId: options.companyId,
        company: {
          id: options.companyId,
          name: "Initiare",
          domain: "localhost"
        }
      }
    ]
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

describe("advanced ops routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    prismaMock.portalAccess.update.mockResolvedValue({ id: "portal-1" });
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates contract draft inside shared review flow", async () => {
    prismaMock.financialDraft.findMany.mockResolvedValue([]);
    prismaMock.legalEntity.findMany.mockResolvedValue([{ id: "legal-1", isDefault: true, legalName: "Main" }]);
    prismaMock.businessClient.findMany.mockResolvedValue([{ id: "client-1", name: "Client A" }]);
    prismaMock.allocationRule.findMany.mockResolvedValue([]);
    prismaMock.financialDraft.create.mockResolvedValue({
      id: "draft-1",
      partyName: "Client A",
      amount: 100,
      status: "PENDENTE_REVISAO"
    });
    const token = await loginAs(app, { role: "ANALYST", companyId: "company-1" });

    const response = await app.inject({
      method: "POST",
      url: "/api/advanced-ops/contracts/generate-drafts",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        contracts: [
          {
            originId: "contract-1",
            businessClientId: "client-1",
            businessClientName: "Client A",
            amount: 100,
            dueDate: "2026-06-10",
            category: "Recorrencia",
            description: "Mensalidade",
            scheduleReason: "monthly_due"
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.financialDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-1",
          sourceLabel: "OMIE contract",
          status: "PENDENTE_REVISAO"
        })
      })
    );
  });

  it("creates read-only portal token and keeps portal slice scoped to one client", async () => {
    prismaMock.businessClient.findFirstOrThrow.mockResolvedValueOnce({
      id: "business-client-1",
      name: "Client A",
      companyId: "company-1"
    });
    prismaMock.portalAccess.create.mockResolvedValueOnce({
      id: "portal-1",
      businessClientId: "business-client-1",
      companyId: "company-1",
      expiresAt: new Date(Date.now() + 3600_000)
    });
    const token = await loginAs(app, { role: "ADMIN", companyId: "company-1" });

    const mintResponse = await app.inject({
      method: "POST",
      url: "/api/advanced-ops/portal/access-token",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        businessClientId: "business-client-1",
        expiresInHours: 12
      }
    });

    expect(mintResponse.statusCode).toBe(200);
    const portalToken = mintResponse.json().token as string;

    prismaMock.portalAccess.findFirst.mockResolvedValueOnce({
      id: "portal-1",
      businessClientId: "business-client-1",
      companyId: "company-1",
      active: true,
      expiresAt: new Date(Date.now() + 3600_000),
      businessClient: {
        id: "business-client-1",
        name: "Client A",
        clientId: "client-1",
        client: {
          id: "client-1",
          name: "Client A"
        }
      }
    });
    prismaMock.accountReceivable.findMany.mockResolvedValue([
      {
        id: "rec-1",
        amount: 220,
        dueDate: new Date("2026-06-11"),
        status: "PROCESSADO",
        source: "OMIE:1",
        channel: "Boleto"
      }
    ]);

    const portalResponse = await app.inject({
      method: "GET",
      url: "/api/portal/overview",
      headers: {
        authorization: `Bearer ${portalToken}`
      }
    });

    expect(portalResponse.statusCode).toBe(200);
    expect(prismaMock.accountReceivable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-1",
          clientId: "client-1"
        })
      })
    );
  });
});
