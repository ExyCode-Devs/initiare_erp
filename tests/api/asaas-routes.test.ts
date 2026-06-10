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
  company: {
    findFirstOrThrow: vi.fn()
  },
  erpSyncRecord: {
    findMany: vi.fn()
  },
  erpWebhookEvent: {
    findMany: vi.fn()
  }
};

const listAsaasConnectionsMock = vi.fn();
const saveAsaasConnectionMock = vi.fn();
const resolveAsaasConnectionMock = vi.fn();
const markAsaasConnectionHealthMock = vi.fn();
const findAsaasConnectionByWebhookTokenMock = vi.fn();
const syncAsaasDataMock = vi.fn();
const processAsaasWebhookMock = vi.fn();
const listCustomersMock = vi.fn();

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../../api/src/lib/asaas-connections.js", () => ({
  findAsaasConnectionByWebhookToken: findAsaasConnectionByWebhookTokenMock,
  listAsaasConnections: listAsaasConnectionsMock,
  saveAsaasConnection: saveAsaasConnectionMock,
  resolveAsaasConnection: resolveAsaasConnectionMock,
  markAsaasConnectionHealth: markAsaasConnectionHealthMock
}));

vi.mock("../../api/src/lib/asaas-sync-service.js", () => ({
  syncAsaasData: syncAsaasDataMock,
  mapAsaasReceivableRow: ({ syncId, charge, webhookStatus, webhookError }: any) => ({
    id: syncId,
    externalId: charge.id,
    customer: charge.customerName,
    amount: charge.grossValue,
    netAmount: charge.netValue,
    fee: charge.feeValue,
    dueDate: charge.dueDate,
    paymentDate: charge.paymentDate,
    status: charge.status,
    billingType: charge.billingType,
    description: charge.description,
    invoiceUrl: charge.invoiceUrl,
    source: "ASAAS",
    webhookStatus,
    webhookError
  })
}));

vi.mock("../../api/src/lib/asaas-webhook-service.js", () => ({
  processAsaasWebhook: processAsaasWebhookMock
}));

vi.mock("../../api/src/lib/asaas-client.ts", () => ({
  AsaasClient: class {
    listCustomers = listCustomersMock;
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
  return loginAs(app, { role: "ADMIN", companyId: "company-1" });
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
    name: "Admin User",
    email: "admin@example.com",
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
      email: "admin@example.com",
      password: "ChangeMe123!"
    }
  });

  return response.json().token as string;
}

describe("asaas routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lists ASAAS settings", async () => {
    listAsaasConnectionsMock.mockResolvedValue([
      {
        id: "conn-1",
        provider: "ASAAS",
        environment: "SANDBOX",
        baseUrl: "https://api-sandbox.asaas.com/v3",
        enabled: true,
        hasApiKey: true,
        hasWebhookToken: true,
        lastSyncAt: null,
        lastHealthcheckAt: null,
        lastHealthcheckStatus: "UNKNOWN",
        lastError: null
      }
    ]);
    const token = await login(app);

    const response = await app.inject({
      method: "GET",
      url: "/api/settings/integrations/asaas",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().provider).toBe("ASAAS");
    expect(listAsaasConnectionsMock).toHaveBeenCalledWith("company-1");
  });

  it("tests connection", async () => {
    resolveAsaasConnectionMock.mockResolvedValue({
      id: "conn-1",
      environment: "SANDBOX",
      baseUrl: "https://api-sandbox.asaas.com/v3",
      apiKey: "$aact_hmlg_secret"
    });
    listCustomersMock.mockResolvedValue({
      data: [{ id: "cus_1" }]
    });
    const token = await login(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/settings/integrations/asaas/SANDBOX/test",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        legalEntityId: "legal-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(markAsaasConnectionHealthMock).toHaveBeenCalled();
    expect(resolveAsaasConnectionMock).toHaveBeenCalledWith("company-1", "legal-1", "SANDBOX");
  });

  it("accepts valid webhook", async () => {
    findAsaasConnectionByWebhookTokenMock.mockResolvedValue({
      companyId: "company-1",
      legalEntityId: "legal-1"
    });
    processAsaasWebhookMock.mockResolvedValue({
      accepted: true,
      eventId: "PAYMENT_RECEIVED:pay_1:no-id",
      eventType: "PAYMENT_RECEIVED",
      status: "SUCCESS"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/integrations/asaas/webhook/SANDBOX",
      headers: {
        "asaas-access-token": "whsec_sandbox_example"
      },
      payload: {
        event: "PAYMENT_RECEIVED",
        payment: { id: "pay_1" }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(processAsaasWebhookMock).toHaveBeenCalled();
  });

  it("does not expose ASAAS secrets when saving settings", async () => {
    saveAsaasConnectionMock.mockResolvedValue({
      id: "conn-1",
      environment: "SANDBOX",
      baseUrl: "https://api-sandbox.asaas.com/v3",
      enabled: true,
      appKeyCipher: "encrypted-api-key",
      webhookAuthTokenCipher: "encrypted-webhook-token"
    });
    const token = await login(app);

    const response = await app.inject({
      method: "PUT",
      url: "/api/settings/integrations/asaas/SANDBOX",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        legalEntityId: "legal-1",
        apiKey: "$aact_sandbox_secret",
        webhookAuthToken: "whsec_plain_secret",
        baseUrl: "https://api-sandbox.asaas.com/v3",
        enabled: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(saveAsaasConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        legalEntityId: "legal-1",
        environment: "SANDBOX"
      })
    );
    expect(response.json()).toEqual({
      id: "conn-1",
      environment: "SANDBOX",
      baseUrl: "https://api-sandbox.asaas.com/v3",
      enabled: true,
      hasApiKey: true,
      hasWebhookToken: true
    });
    expect(response.body).not.toContain("$aact_sandbox_secret");
    expect(response.body).not.toContain("whsec_plain_secret");
    expect(response.body).not.toContain("encrypted-api-key");
    expect(response.body).not.toContain("encrypted-webhook-token");
  });

  it("blocks non-admin ASAAS mutations", async () => {
    const token = await loginAs(app, { role: "ANALYST", companyId: "company-1" });

    const response = await app.inject({
      method: "POST",
      url: "/api/settings/integrations/asaas/SANDBOX/test",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        legalEntityId: "legal-1"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(resolveAsaasConnectionMock).not.toHaveBeenCalled();
  });
});
