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
  legalEntity: {
    create: vi.fn(),
    findFirstOrThrow: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
};

const listLegalEntitiesMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../../api/src/lib/legal-entities.js", () => ({
  listLegalEntities: listLegalEntitiesMock
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

describe("legal entity routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lists legal entities scoped to the authenticated company", async () => {
    listLegalEntitiesMock.mockResolvedValue([
      {
        id: "legal-1",
        legalName: "Initiare Holding LTDA",
        tradeName: "Initiare",
        cnpj: "12345678000199",
        active: true,
        isDefault: true,
        defaultRecipientEmails: ["finance@example.com"],
        defaultMailboxIds: ["mailbox-1"],
        notes: null,
        createdAt: new Date("2026-06-08T10:00:00Z"),
        updatedAt: new Date("2026-06-08T10:00:00Z")
      }
    ]);
    const token = await loginAs(app, { role: "ADMIN", companyId: "company-1" });

    const response = await app.inject({
      method: "GET",
      url: "/api/settings/legal-entities",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(listLegalEntitiesMock).toHaveBeenCalledWith("company-1");
    expect(response.json().items).toHaveLength(1);
  });

  it("blocks non-admin legal-entity writes", async () => {
    const token = await loginAs(app, { role: "ANALYST", companyId: "company-1" });

    const response = await app.inject({
      method: "POST",
      url: "/api/settings/legal-entities",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        legalName: "Client Ops LTDA",
        cnpj: "00987654000100"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(prismaMock.legalEntity.create).not.toHaveBeenCalled();
  });

  it("checks company ownership before updating a legal entity", async () => {
    prismaMock.legalEntity.findFirstOrThrow.mockResolvedValue({
      id: "legal-1",
      companyId: "company-1"
    });
    prismaMock.legalEntity.update.mockResolvedValue({
      id: "legal-1",
      legalName: "Client Ops LTDA",
      tradeName: null,
      cnpj: "00987654000100",
      active: true,
      isDefault: false,
      defaultRecipientEmails: [],
      defaultMailboxIds: [],
      notes: null,
      createdAt: new Date("2026-06-08T10:00:00Z"),
      updatedAt: new Date("2026-06-08T10:00:00Z")
    });
    const token = await loginAs(app, { role: "ADMIN", companyId: "company-1" });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/settings/legal-entities/legal-1",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        legalName: "Client Ops LTDA"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.legalEntity.findFirstOrThrow).toHaveBeenCalledWith({
      where: {
        id: "legal-1",
        companyId: "company-1"
      }
    });
  });
});
