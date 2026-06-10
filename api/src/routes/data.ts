import type { ErpProvider, FinanceStatus, LogStatus, Severity } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
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

function formatMoney(value: number) {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

const dataRoutes: FastifyPluginAsync = async (app) => {
  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", protectedApp.authenticate);

    protectedApp.get("/operations", async (request) => {
      const companyId = request.user.companyId;
      const items = await prisma.operation.findMany({
        where: { companyId },
        include: { supplier: true },
        orderBy: { dueDate: "desc" }
      });

      return {
        stats: {
          total: items.length,
          processedByAi: items.filter((item) => item.assignee === "IA").length,
          inReview: items.filter((item) => item.status === "EM_REVISAO").length,
          exceptions: items.filter((item) => item.status === "EXCECAO").length
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
          delinquencyRate: "2.1%",
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
      const [company, integrations] = await Promise.all([
        prisma.company.findUniqueOrThrow({ where: { id: request.user.companyId } }),
        prisma.integration.findMany({ where: { companyId: request.user.companyId }, orderBy: { name: "asc" } })
      ]);
      const omieConnection = await prisma.erpConnection.findFirst({
        where: {
          companyId: request.user.companyId,
          provider: "OMIE" as ErpProvider
        },
        orderBy: {
          updatedAt: "desc"
        }
      });
      const asaasConnection = await prisma.erpConnection.findFirst({
        where: {
          companyId: request.user.companyId,
          provider: "ASAAS" as ErpProvider
        },
        orderBy: {
          updatedAt: "desc"
        }
      });
      const integrationItems = integrations.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status === "CONNECTED" ? "connected" : "available",
        desc: item.description
      }));
      const hasOmieCard = integrationItems.some((item) => item.name.toUpperCase() === "OMIE");
      if (!hasOmieCard) {
        integrationItems.unshift({
          id: omieConnection?.id ?? "omie",
          name: "OMIE",
          status: omieConnection?.enabled ? "connected" : "available",
          desc:
            omieConnection == null
              ? "ERP principal. Configure homologacao e producao."
              : `ERP principal. Ultimo status ${omieConnection.lastHealthcheckStatus.toLowerCase()}.`
        });
      }
      const hasAsaasCard = integrationItems.some((item) => item.name.toUpperCase() === "ASAAS");
      if (!hasAsaasCard) {
        integrationItems.unshift({
          id: asaasConnection?.id ?? "asaas",
          name: "ASAAS",
          status: asaasConnection?.enabled ? "connected" : "available",
          desc:
            asaasConnection == null
              ? "Recebiveis e webhooks. Configure sandbox e producao."
              : `Recebiveis e webhooks. Ultimo status ${asaasConnection.lastHealthcheckStatus.toLowerCase()}.`
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
          { l: "Modelo padrao", v: "veridia-finance-v3.2" },
          { l: "Threshold de autonomia", v: "90%", hint: "Decisoes abaixo disso vao para revisao humana" },
          { l: "Modo agressivo", v: "Desativado", hint: "Permite a IA agir em casos de baixa confianca" },
          { l: "Aprendizado continuo", v: "Ativado" }
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
  });
};

export default dataRoutes;
