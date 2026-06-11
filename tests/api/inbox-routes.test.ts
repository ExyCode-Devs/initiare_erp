import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readFileMock = vi.fn();

const prismaMock = {
  $queryRaw: vi.fn(),
  user: {
    findUnique: vi.fn()
  },
  auditLog: {
    create: vi.fn()
  },
  inboundEmail: {
    findMany: vi.fn(),
    findFirstOrThrow: vi.fn()
  },
  emailAttachment: {
    findFirstOrThrow: vi.fn()
  }
};

const resolveStoredFilePathMock = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock
}));

vi.mock("../../api/src/lib/prisma.js", () => ({
  prisma: prismaMock
}));

vi.mock("../../api/src/lib/storage.js", () => ({
  resolveStoredFilePath: resolveStoredFilePathMock
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

describe("inbox routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    resolveStoredFilePathMock.mockReturnValue("C:\\temp\\invoice.pdf");
    readFileMock.mockResolvedValue(Buffer.from("pdf-content"));
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lists inbox emails scoped to the authenticated company", async () => {
    prismaMock.inboundEmail.findMany.mockResolvedValue([
      {
        id: "email-1",
        sender: "billing@example.com",
        subject: "Invoice",
        receivedAt: new Date("2026-06-10T12:00:00Z"),
        status: "AGUARDANDO_VALIDACAO",
        mailbox: {
          name: "Financeiro"
        },
        attachments: [{ id: "att-1" }],
        extractionRuns: [{ status: "SUCESSO" }],
        financialDrafts: [
          {
            id: "draft-1",
            direction: "CONTA_PAGAR",
            partyName: "CloudPlus",
            amount: 1200,
            confidenceScore: 88,
            confidenceBand: "ALTA",
            status: "PENDENTE_REVISAO"
          }
        ]
      }
    ]);
    const token = await loginAs(app, { role: "ANALYST", companyId: "company-1" });

    const response = await app.inject({
      method: "GET",
      url: "/api/inbox/emails?limit=20&confidenceBand=ALTA",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.inboundEmail.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-1",
          financialDrafts: {
            some: {
              confidenceBand: "ALTA"
            }
          }
        })
      })
    );
  });

  it("returns inbox detail scoped to the authenticated company", async () => {
    prismaMock.inboundEmail.findFirstOrThrow.mockResolvedValue({
      id: "email-1",
      sender: "billing@example.com",
      replyTo: null,
      toRecipients: ["finance@example.com"],
      ccRecipients: [],
      bccRecipients: [],
      subject: "Invoice",
      bodyText: "Invoice body",
      bodyHtml: null,
      receivedAt: new Date("2026-06-10T12:00:00Z"),
      status: "AGUARDANDO_VALIDACAO",
      processingError: null,
      mailbox: {
        name: "Financeiro"
      },
      attachments: [
        {
          id: "att-1",
          originalName: "invoice.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          status: "EXTRAIDO",
          processingError: null,
          extractedText: "invoice text"
        }
      ],
      extractionRuns: [
        {
          id: "run-1",
          provider: "n8n",
          workflowId: "wf-1",
          status: "SUCESSO",
          durationMs: 500,
          errorMessage: null,
          startedAt: new Date("2026-06-10T12:00:00Z"),
          completedAt: new Date("2026-06-10T12:00:01Z"),
          parsedResponse: { ok: true }
        }
      ],
      financialDrafts: [
        {
          id: "draft-1",
          direction: "CONTA_PAGAR",
          partyName: "CloudPlus",
          cpfCnpj: null,
          amount: 1200,
          dueDate: null,
          competence: null,
          description: "Invoice description",
          suggestedCategory: null,
          finalCategory: null,
          paymentMethod: null,
          bankData: null,
          notes: null,
          confidenceScore: 88,
          confidenceBand: "ALTA",
          status: "PENDENTE_REVISAO",
          evidence: [],
          rawPayload: {},
          rejectionReason: null,
          reviews: []
        }
      ]
    });
    const token = await loginAs(app, { role: "VIEWER", companyId: "company-1" });

    const response = await app.inject({
      method: "GET",
      url: "/api/inbox/emails/email-1",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.inboundEmail.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "email-1",
          companyId: "company-1"
        }
      })
    );
  });

  it("downloads attachment scoped to the authenticated company", async () => {
    prismaMock.emailAttachment.findFirstOrThrow.mockResolvedValue({
      id: "att-1",
      companyId: "company-1",
      originalName: "invoice.pdf",
      mimeType: "application/pdf",
      storagePath: "company-1/emails/email-1/invoice.pdf"
    });
    const token = await loginAs(app, { role: "VIEWER", companyId: "company-1" });

    const response = await app.inject({
      method: "GET",
      url: "/api/attachments/att-1/download",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(prismaMock.emailAttachment.findFirstOrThrow).toHaveBeenCalledWith({
      where: {
        id: "att-1",
        companyId: "company-1"
      }
    });
    expect(resolveStoredFilePathMock).toHaveBeenCalledWith("company-1/emails/email-1/invoice.pdf");
    expect(readFileMock).toHaveBeenCalledWith("C:\\temp\\invoice.pdf");
  });
});
