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
  mailboxAccount: {
    findMany: vi.fn(),
    create: vi.fn()
  }
};

const encryptMailboxSecretMock = vi.fn();
const testMailboxConnectionMock = vi.fn();
const processMailboxAccountMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../../api/src/lib/mailbox-crypto.js", () => ({
  encryptMailboxSecret: encryptMailboxSecretMock
}));

vi.mock("../../api/src/lib/inbox-processing.js", () => ({
  testMailboxConnection: testMailboxConnectionMock,
  processMailboxAccount: processMailboxAccountMock
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

describe("mailbox routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    encryptMailboxSecretMock.mockReturnValue("ciphered-password");
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lists mailboxes scoped to the authenticated company", async () => {
    prismaMock.mailboxAccount.findMany.mockResolvedValue([
      {
        id: "mailbox-1",
        name: "Financeiro",
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        username: "finance@example.com",
        fromFilter: null,
        active: true,
        lastSyncAt: null,
        lastError: null,
        createdAt: new Date("2026-06-10T12:00:00Z")
      }
    ]);
    const token = await loginAs(app, { role: "ADMIN", companyId: "company-1" });

    const response = await app.inject({
      method: "GET",
      url: "/api/mailboxes",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.mailboxAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-1"
        }
      })
    );
    expect(response.body).not.toContain("password");
  });

  it("creates mailbox without exposing the stored secret", async () => {
    prismaMock.mailboxAccount.create.mockResolvedValue({
      id: "mailbox-1",
      name: "Financeiro",
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      username: "finance@example.com",
      fromFilter: null,
      active: true,
      lastSyncAt: null,
      lastError: null,
      createdAt: new Date("2026-06-10T12:00:00Z")
    });
    const token = await loginAs(app, { role: "ADMIN", companyId: "company-1" });

    const response = await app.inject({
      method: "POST",
      url: "/api/mailboxes",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        name: "Financeiro",
        host: "imap.gmail.com",
        port: 993,
        tls: true,
        username: "finance@example.com",
        password: "app-password-123",
        fromFilter: null,
        active: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(encryptMailboxSecretMock).toHaveBeenCalledWith("app-password-123");
    expect(prismaMock.mailboxAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-1",
          passwordCipher: "ciphered-password"
        })
      })
    );
    expect(response.body).not.toContain("app-password-123");
    expect(response.body).not.toContain("ciphered-password");
  });

  it("blocks non-admin mailbox sync actions", async () => {
    const token = await loginAs(app, { role: "ANALYST", companyId: "company-1" });

    const response = await app.inject({
      method: "POST",
      url: "/api/mailboxes/mailbox-1/sync",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(processMailboxAccountMock).not.toHaveBeenCalled();
  });
});
