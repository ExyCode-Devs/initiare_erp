import type { ErpProvider, FinanceStatus, LogStatus, Severity } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { normalizeAutomationSettings } from "../lib/automation-settings.js";
import { prisma } from "../lib/prisma.js";

const financeStatusMap: Record<FinanceStatus, string> = {
  PROCESSADO: "Processado",
  EM_REVISAO: "Em revisao",
  EXCECAO: "Excecao",
  CONCILIADO: "Conciliado",
  PENDENTE: "Pendente"
};

const severityMap: Record<Severity, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAIXA: "Baixa"
};

const logStatusMap: Record<LogStatus, string> = {
  OK: "ok",
  WARN: "warn",
  ERR: "err"
};

const exceptionDecisionSchema = z.object({
  status: z.enum(["OPEN", "APPROVED", "REJECTED"])
});

const automationStatusSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED"])
});

const companySettingsSchema = z.object({
  name: z.string().trim().min(2),
  domain: z.string().trim().min(2),
  replyFromName: z.string().trim().nullable().optional(),
  replyFromEmail: z.string().trim().email().nullable().optional(),
  replyToEmail: z.string().trim().email().nullable().optional()
});

const automationSettingsUpdateSchema = z.object({
  emailIngestEnabled: z.boolean(),
  batchProcessingEnabled: z.boolean(),
  autoSyncMailboxes: z.boolean(),
  autoTestIntegrations: z.boolean(),
  draftAutoReprocess: z.boolean(),
  notificationDigestEnabled: z.boolean(),
  defaultEnvironment: z.enum(["HOMOLOG", "SANDBOX"]),
  maxEmailsPerRun: z.coerce.number().int().min(1).max(100),
  batchIntervalMinutes: z.coerce.number().int().min(1).max(1440)
});

const operationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200)
});

function formatMoney(value: number) {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

function toIsoDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

const isProduction = process.env.NODE_ENV === "production";

const dataRoutes: FastifyPluginAsync = async (app) => {
  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", protectedApp.authenticate);

    protectedApp.get("/operations", async (request) => {
      const companyId = request.user.companyId;
      const { limit } = operationsQuerySchema.parse(request.query);
      const [items, total, processedByAi, inReview, exceptions] = await Promise.all([
        prisma.operation.findMany({
          where: { companyId },
          orderBy: { dueDate: "desc" },
          take: limit,
          select: {
            id: true,
            reference: true,
            amount: true,
            dueDate: true,
            category: true,
            status: true,
            source: true,
            confidence: true,
            assignee: true,
            supplier: {
              select: {
                name: true
              }
            }
          }
        }),
        prisma.operation.count({
          where: { companyId }
        }),
        prisma.operation.count({
          where: { companyId, assignee: "IA" }
        }),
        prisma.operation.count({
          where: { companyId, status: "EM_REVISAO" }
        }),
        prisma.operation.count({
          where: { companyId, status: "EXCECAO" }
        })
      ]);

      return {
        stats: {
          total,
          processedByAi,
          inReview,
          exceptions
        },
        items: items.map((item) => ({
          id: item.id,
          reference: item.reference,
          fornecedor: item.supplier?.name ?? "Sem fornecedor",
          valor: Number(item.amount),
          vencimento: item.dueDate.toISOString(),
          categoria: item.category,
          status: financeStatusMap[item.status],
          origem: item.source,
          confianca: item.confidence,
          responsavel: item.assignee
        }))
      };
    });

    protectedApp.get("/accounts-payable", async (request) => {
      const companyId = request.user.companyId;
      const items = await prisma.accountPayable.findMany({
        where: { companyId },
        include: { supplier: true },
        orderBy: { dueDate: "asc" }
      });

      const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
      const dueIn7Days = items.filter((item) => item.dueDate.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000);
      const overdue = items.filter((item) => item.dueDate.getTime() < Date.now() && item.status !== "CONCILIADO");

      return {
        stats: {
          total: formatMoney(total),
          dueIn7Days: formatMoney(dueIn7Days.reduce((sum, item) => sum + Number(item.amount), 0)),
          scheduledByAi: items.filter((item) => item.assignee === "IA").length,
          overdue: overdue.length
        },
        items: items.map((item) => ({
          id: item.id,
          fornecedor: item.supplier?.name ?? "Sem fornecedor",
          valor: Number(item.amount),
          vencimento: item.dueDate.toISOString(),
          categoria: item.category,
          status: financeStatusMap[item.status],
          confianca: item.confidence
        }))
      };
    });

    protectedApp.get("/accounts-receivable", async (request) => {
      const companyId = request.user.companyId;
      const items = await prisma.accountReceivable.findMany({
        where: { companyId },
        include: { client: true },
        orderBy: { dueDate: "asc" }
      });

      const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
      const dueIn7Days = items.filter((item) => item.dueDate.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000);
      const received = items.filter((item) => item.status === "CONCILIADO").reduce((sum, item) => sum + Number(item.amount), 0);

      return {
        stats: {
          total: formatMoney(total),
          dueIn7Days: formatMoney(dueIn7Days.reduce((sum, item) => sum + Number(item.amount), 0)),
          delinquencyRate: "0%",
          receivedMonth: formatMoney(received)
        },
        items: items.map((item) => ({
          id: item.id,
          cliente: item.client?.name ?? "Sem cliente",
          valor: Number(item.amount),
          venc: item.dueDate.toISOString(),
          status: financeStatusMap[item.status],
          origem: item.source,
          canal: item.channel
        }))
      };
    });

    protectedApp.get("/clients", async (request) => {
      const items = await prisma.client.findMany({
        where: { companyId: request.user.companyId },
        orderBy: { annualRevenue: "desc" }
      });

      return {
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          document: item.document,
          segment: item.segment,
          revenue: Number(item.annualRevenue),
          status: item.status,
          since: String(item.sinceYear)
        }))
      };
    });

    protectedApp.get("/suppliers", async (request) => {
      const items = await prisma.supplier.findMany({
        where: { companyId: request.user.companyId },
        orderBy: { yearlySpend: "desc" }
      });

      return {
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          cnpj: item.cnpj ?? "-",
          category: item.category,
          spend: Number(item.yearlySpend),
          last: item.lastTransaction
        }))
      };
    });

    protectedApp.get("/reconciliation", async (request) => {
      const items = await prisma.reconciliationItem.findMany({
        where: { companyId: request.user.companyId },
        orderBy: { bankDate: "desc" }
      });

      const matched = items.filter((item) => item.matchScore >= 0.98).length;
      const pending = items.filter((item) => item.matchScore > 0 && item.matchScore < 0.98).length;
      const divergent = items.filter((item) => item.matchScore === 0).length;

      return {
        stats: {
          reconciledRate: items.length ? `${Math.round((matched / items.length) * 100)}%` : "0%",
          reconciledCount: matched,
          pending,
          divergent
        },
        items: items.map((item) => ({
          id: item.id,
          bank: {
            date: item.bankDate.toLocaleDateString("pt-BR"),
            desc: item.bankDescription,
            value: Number(item.bankValue)
          },
          book: {
            date: item.bookDate ? item.bookDate.toLocaleDateString("pt-BR") : "-",
            desc: item.bookDescription,
            value: Number(item.bookValue)
          },
          match: item.matchScore
        }))
      };
    });

    protectedApp.get("/exceptions", async (request) => {
      const items = await prisma.exceptionItem.findMany({
        where: { companyId: request.user.companyId },
        orderBy: { updatedAt: "desc" }
      });

      return {
        summary: {
          open: items.filter((item) => item.status === "OPEN").length
        },
        items: items.map((item) => ({
          id: item.id,
          code: item.code,
          title: item.title,
          desc: item.description,
          suggestion: item.suggestion,
          confidence: item.confidence,
          severity: severityMap[item.severity],
          time: item.timeLabel,
          status: item.status,
          timeline: item.timeline
        }))
      };
    });

    protectedApp.patch<{ Params: { id: string } }>(
      "/exceptions/:id",
      {
        preHandler: protectedApp.authorize(["ADMIN", "ANALYST"])
      },
      async (request) => {
        const payload = exceptionDecisionSchema.parse(request.body);

        const item = await prisma.exceptionItem.update({
          where: { id: request.params.id },
          data: { status: payload.status }
        });

        await prisma.auditLog.create({
          data: {
            action: "exception.update",
            resource: "exception",
            companyId: request.user.companyId,
            userId: request.user.sub,
            details: { id: item.id, status: payload.status }
          }
        });

        return { status: item.status };
      }
    );

    protectedApp.get("/ai/logs", async (request) => {
      const items = await prisma.aiLog.findMany({
        where: { companyId: request.user.companyId },
        orderBy: { occurredAt: "desc" }
      });

      return {
        items: items.map((item) => ({
          id: item.id,
          time: item.occurredAt.toLocaleTimeString("pt-BR"),
          input: item.input,
          action: item.action,
          confidence: item.confidence,
          status: logStatusMap[item.status],
          parsedPayload: item.parsedPayload,
          justification: item.justification
        }))
      };
    });

    protectedApp.get("/integrations/errors", async (request) => {
      const companyId = request.user.companyId;
      const limit = z
        .object({
          limit: z.coerce.number().int().min(1).max(200).default(100)
        })
        .parse(request.query).limit;

      const [requestErrors, webhookErrors, connectionErrors, mailboxErrors] = await Promise.all([
        prisma.erpRequestLog.findMany({
          where: {
            companyId,
            operationStatus: "ERROR"
          },
          include: {
            connection: {
              include: {
                legalEntity: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: limit
        }),
        prisma.erpWebhookEvent.findMany({
          where: {
            companyId,
            status: "ERROR"
          },
          include: {
            connection: {
              include: {
                legalEntity: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: limit
        }),
        prisma.erpConnection.findMany({
          where: {
            companyId,
            enabled: true,
            lastError: {
              not: null
            }
          },
          include: {
            legalEntity: true
          },
          orderBy: {
            lastHealthcheckAt: "desc"
          },
          take: limit
        }),
        prisma.mailboxAccount.findMany({
          where: {
            companyId,
            active: true,
            lastError: {
              not: null
            }
          },
          include: {
            legalEntity: true
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: limit
        })
      ]);

      const items = [
        ...requestErrors.map((item) => ({
          id: `req:${item.id}`,
          sourceType: "REQUEST",
          provider: item.connection.provider,
          environment: item.connection.environment,
          legalEntityName: item.connection.legalEntity.tradeName?.trim() || item.connection.legalEntity.legalName,
          title: `${item.connection.provider} request failed`,
          message: item.friendlyError ?? item.technicalError ?? "External request failed",
          technicalError: item.technicalError,
          endpoint: item.endpoint,
          method: item.method,
          httpStatus: item.httpStatus,
          draftId: item.draftId,
          externalEventId: null,
          connectionId: item.connectionId,
          mailboxId: null,
          occurredAt: item.createdAt.toISOString()
        })),
        ...webhookErrors.map((item) => ({
          id: `webhook:${item.id}`,
          sourceType: "WEBHOOK",
          provider: item.provider,
          environment: item.environment,
          legalEntityName:
            item.connection?.legalEntity.tradeName?.trim() || item.connection?.legalEntity.legalName || null,
          title: `${item.provider} webhook failed`,
          message: item.errorMessage ?? "Webhook processing failed",
          technicalError: item.errorMessage,
          endpoint: null,
          method: "POST",
          httpStatus: null,
          draftId: null,
          externalEventId: item.externalEventId,
          connectionId: item.connectionId,
          mailboxId: null,
          occurredAt: item.createdAt.toISOString()
        })),
        ...connectionErrors.map((item) => ({
          id: `connection:${item.id}:${item.lastHealthcheckAt?.toISOString() ?? item.updatedAt.toISOString()}`,
          sourceType: "CONNECTION",
          provider: item.provider,
          environment: item.environment,
          legalEntityName: item.legalEntity.tradeName?.trim() || item.legalEntity.legalName,
          title: `${item.provider} connection unhealthy`,
          message: item.lastError ?? "Connection healthcheck failed",
          technicalError: item.lastError,
          endpoint: item.baseUrl,
          method: null,
          httpStatus: null,
          draftId: null,
          externalEventId: null,
          connectionId: item.id,
          mailboxId: null,
          occurredAt: toIsoDate(item.lastHealthcheckAt) ?? item.updatedAt.toISOString()
        })),
        ...mailboxErrors.map((item) => ({
          id: `mailbox:${item.id}:${item.updatedAt.toISOString()}`,
          sourceType: "MAILBOX",
          provider: "MAILBOX",
          environment: null,
          legalEntityName: item.legalEntity?.tradeName?.trim() || item.legalEntity?.legalName || null,
          title: "Mailbox sync failed",
          message: item.lastError ?? "Mailbox processing failed",
          technicalError: item.lastError,
          endpoint: item.host,
          method: null,
          httpStatus: null,
          draftId: null,
          externalEventId: null,
          connectionId: null,
          mailboxId: item.id,
          occurredAt: item.updatedAt.toISOString()
        }))
      ]
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        .slice(0, limit);

      return {
        stats: {
          total: items.length,
          requestErrors: items.filter((item) => item.sourceType === "REQUEST").length,
          webhookErrors: items.filter((item) => item.sourceType === "WEBHOOK").length,
          connectionErrors: items.filter((item) => item.sourceType === "CONNECTION").length,
          mailboxErrors: items.filter((item) => item.sourceType === "MAILBOX").length
        },
        items
      };
    });

    protectedApp.get("/automations", async (request) => {
      const items = await prisma.automation.findMany({
        where: { companyId: request.user.companyId },
        orderBy: { title: "asc" }
      });

      return {
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          desc: item.description,
          runs: item.runs,
          accuracy: item.accuracy,
          status: item.status === "ACTIVE" ? "active" : "paused"
        }))
      };
    });

    protectedApp.patch<{ Params: { id: string } }>(
      "/automations/:id",
      {
        preHandler: protectedApp.authorize(["ADMIN"])
      },
      async (request) => {
        const payload = automationStatusSchema.parse(request.body);

        const item = await prisma.automation.update({
          where: { id: request.params.id },
          data: { status: payload.status }
        });

        await prisma.auditLog.create({
          data: {
            action: "automation.update",
            resource: "automation",
            companyId: request.user.companyId,
            userId: request.user.sub,
            details: { id: item.id, status: payload.status }
          }
        });

        return {
          id: item.id,
          status: item.status === "ACTIVE" ? "active" : "paused"
        };
      }
    );

    protectedApp.get("/flows", async (request) => {
      if (isProduction) {
        return {
          items: []
        };
      }

      const items = await prisma.flow.findMany({
        where: { companyId: request.user.companyId },
        orderBy: { name: "asc" }
      });

      return {
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          desc: item.description,
          runs: item.runs,
          status: item.status === "ACTIVE" ? "active" : "paused",
          steps: item.steps
        }))
      };
    });

    protectedApp.get("/reports", async (request) => {
      const items = await prisma.report.findMany({
        where: { companyId: request.user.companyId },
        orderBy: { name: "asc" }
      });

      return {
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          desc: item.description,
          updated: item.updatedLabel
        }))
      };
    });

    protectedApp.get("/settings", async (request) => {
      const [company, integrations, erpConnections, aiLogCount, automationCount] = await Promise.all([
        prisma.company.findUniqueOrThrow({ where: { id: request.user.companyId } }),
        prisma.integration.findMany({ where: { companyId: request.user.companyId }, orderBy: { name: "asc" } }),
        prisma.erpConnection.findMany({ where: { companyId: request.user.companyId } }),
        prisma.aiLog.count({ where: { companyId: request.user.companyId } }),
        prisma.automation.count({ where: { companyId: request.user.companyId } })
      ]);

      const omieConnections = erpConnections.filter((item) => item.provider === "OMIE");
      const asaasConnections = erpConnections.filter((item) => item.provider === "ASAAS");
      const omieConnected = omieConnections.some((item) => item.enabled);
      const asaasConnected = asaasConnections.some((item) => item.enabled);

      const integrationItems = integrations.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status === "CONNECTED" ? "connected" : "available",
        desc: item.description
      }));
      const hasOmieCard = integrationItems.some((item) => item.name.toUpperCase() === "OMIE");
      if (!hasOmieCard) {
        integrationItems.unshift({
          id: omieConnections[0]?.id ?? "omie",
          name: "OMIE",
          status: omieConnected ? "connected" : "available",
          desc:
            omieConnections.length === 0
              ? "ERP principal. Configure homologacao e producao."
              : `${omieConnections.length} conexao(oes) OMIE registradas.`
        });
      }
      const hasAsaasCard = integrationItems.some((item) => item.name.toUpperCase() === "ASAAS");
      if (!hasAsaasCard) {
        integrationItems.unshift({
          id: asaasConnections[0]?.id ?? "asaas",
          name: "ASAAS",
          status: asaasConnected ? "connected" : "available",
          desc:
            asaasConnections.length === 0
              ? "Recebiveis e webhooks. Configure sandbox e producao."
              : `${asaasConnections.length} conexao(oes) ASAAS registradas.`
        });
      }

      return {
        sections: [
          { id: "empresa", label: "Empresa", icon: "Building2" },
          { id: "usuarios", label: "Usuarios & Permissoes", icon: "Users" },
          { id: "integracoes", label: "Integracoes", icon: "Plug" },
          { id: "ia", label: "IA & Modelos", icon: "Brain" },
          { id: "automacao", label: "Automacao", icon: "Zap" },
          { id: "notificacoes", label: "Notificacoes", icon: "Bell" },
          { id: "seguranca", label: "Seguranca", icon: "Shield" }
        ],
        company: {
          name: company.name,
          domain: company.domain,
          companiesCount: company.companiesCount,
          replyFromName: company.replyFromName,
          replyFromEmail: company.replyFromEmail,
          replyToEmail: company.replyToEmail
        },
        integrations: integrationItems,
        ai: [
          { l: "Modelo padrao", v: aiLogCount > 0 ? "Configurado" : "Nao configurado" },
          { l: "Threshold de autonomia", v: "Nao configurado", hint: "Defina quando a IA real estiver ativa." },
          { l: "Modo agressivo", v: "Desativado", hint: "Nenhuma automacao de IA esta ativa sem pipeline configurado." },
          { l: "Automações registradas", v: String(automationCount) }
        ]
      };
    });

    protectedApp.patch(
      "/settings/company",
      {
        preHandler: protectedApp.authorize(["ADMIN"])
      },
      async (request) => {
        const payload = companySettingsSchema.parse(request.body);

        const company = await prisma.company.update({
          where: { id: request.user.companyId },
          data: {
            name: payload.name,
            domain: payload.domain,
            replyFromName: payload.replyFromName?.trim() || null,
            replyFromEmail: payload.replyFromEmail?.trim().toLowerCase() || null,
            replyToEmail: payload.replyToEmail?.trim().toLowerCase() || null
          }
        });

        return {
          company: {
            id: company.id,
            name: company.name,
            domain: company.domain,
            companiesCount: company.companiesCount,
            replyFromName: company.replyFromName,
            replyFromEmail: company.replyFromEmail,
            replyToEmail: company.replyToEmail
          }
        };
      }
    );

    protectedApp.get("/settings/automation", async (request) => {
      const company = await prisma.company.findUniqueOrThrow({
        where: { id: request.user.companyId },
        select: { automationSettings: true }
      });

      return {
        settings: normalizeAutomationSettings(company.automationSettings)
      };
    });

    protectedApp.patch(
      "/settings/automation",
      {
        preHandler: protectedApp.authorize(["ADMIN"])
      },
      async (request) => {
        const payload = automationSettingsUpdateSchema.parse(request.body);

        const company = await prisma.company.update({
          where: { id: request.user.companyId },
          data: {
            automationSettings: payload
          },
          select: {
            automationSettings: true
          }
        });

        await prisma.auditLog.create({
          data: {
            action: "automation.settings.update",
            resource: "company",
            companyId: request.user.companyId,
            userId: request.user.sub,
            details: payload
          }
        });

        return {
          settings: normalizeAutomationSettings(company.automationSettings)
        };
      }
    );
  });
};

export default dataRoutes;
