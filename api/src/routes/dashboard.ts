import type { FastifyPluginAsync } from "fastify";
import { ErpProvider, ErpSyncEntityType, ErpSyncStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const currency = (value: number) => value;

const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/dashboard/overview", async (request) => {
    const companyId = request.user.companyId;

    const [
      payableItems,
      receivableItems,
      operations,
      exceptions,
      aiLogs,
      cashflow,
      expensesByCategory,
      reconciliationDaily,
      omieSyncs,
      asaasChargeSyncs,
      asaasWebhookEvents
    ] = await Promise.all([
      prisma.accountPayable.findMany({ where: { companyId } }),
      prisma.accountReceivable.findMany({ where: { companyId } }),
      prisma.operation.findMany({ where: { companyId }, orderBy: { dueDate: "desc" }, take: 42 }),
      prisma.exceptionItem.findMany({ where: { companyId }, orderBy: { updatedAt: "desc" } }),
      prisma.aiLog.findMany({ where: { companyId }, orderBy: { occurredAt: "desc" }, take: 8 }),
      prisma.cashflowPoint.findMany({ where: { companyId }, orderBy: { monthKey: "asc" } }),
      prisma.expenseCategory.findMany({ where: { companyId } }),
      prisma.dailyReconciliationPoint.findMany({ where: { companyId }, orderBy: { day: "asc" } }),
      prisma.erpSyncRecord.findMany({
        where: {
          companyId,
          provider: ErpProvider.OMIE
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 10
      }),
      prisma.erpSyncRecord.findMany({
        where: {
          companyId,
          provider: ErpProvider.ASAAS,
          entityType: ErpSyncEntityType.CHARGE
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: 20
      }),
      prisma.erpWebhookEvent.findMany({
        where: {
          companyId,
          provider: ErpProvider.ASAAS
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 20
      })
    ]);

    const totalPayables = payableItems.reduce((sum, item) => sum + Number(item.amount), 0);
    const dueIn7Days = payableItems.filter((item) => {
      const diff = item.dueDate.getTime() - Date.now();
      return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
    });
    const autoProcessedValue = operations
      .filter((item) => item.assignee === "IA")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const reconciledOperations = operations.filter((item) => item.status === "CONCILIADO").length;
    const exceptionCount = exceptions.filter((item) => item.status === "OPEN").length;
    const totalConnections = await prisma.erpConnection.count({ where: { companyId, enabled: true } });
    const healthyConnections = await prisma.erpConnection.count({
      where: {
        companyId,
        enabled: true,
        lastHealthcheckStatus: "HEALTHY"
      }
    });
    const omieSuccess = omieSyncs.filter((item) => item.status === ErpSyncStatus.SUCCESS).length;
    const omieError = omieSyncs.filter((item) => item.status === ErpSyncStatus.ERROR).length;
    const omieBlocked = omieSyncs.filter((item) => item.status === ErpSyncStatus.BLOCKED).length;
    const asaasPaid = asaasChargeSyncs.filter((item) => {
      const payload = (item.requestPayload ?? {}) as Record<string, unknown>;
      return /RECEIVED|CONFIRMED|PAID/i.test(String(payload.status ?? ""));
    });
    const asaasOverdue = asaasChargeSyncs.filter((item) => {
      const payload = (item.requestPayload ?? {}) as Record<string, unknown>;
      return /OVERDUE/i.test(String(payload.status ?? ""));
    });
    const asaasNetReceived = asaasPaid.reduce((sum, item) => {
      const payload = (item.requestPayload ?? {}) as Record<string, unknown>;
      return sum + Number(payload.netValue ?? 0);
    }, 0);
    const asaasFees = asaasChargeSyncs.reduce((sum, item) => {
      const payload = (item.requestPayload ?? {}) as Record<string, unknown>;
      return sum + Number(payload.feeValue ?? 0);
    }, 0);
    const asaasErrors = asaasWebhookEvents.filter((item) => item.status === ErpSyncStatus.ERROR).length;

    return {
      hero: {
        greetingName: request.user.name.split(" ")[0],
        cycleLabel: aiLogs[0] ? "ultima-execucao-registrada" : "aguardando-primeira-execucao",
        processedToday: operations.length,
        openExceptions: exceptionCount,
        uptime: aiLogs.length ? 100 : 0,
        integrationsHealthy: healthyConnections,
        integrationsTotal: totalConnections,
        latencyMs: 0
      },
      stats: {
        autoReconciliationRate: operations.length
          ? Math.round((reconciledOperations / operations.length) * 100)
          : 0,
        processedByAiAmount: currency(autoProcessedValue),
        openExceptions: exceptionCount,
        scheduledPayments: dueIn7Days.length
      },
      cashflow: cashflow.map((item) => ({
        month: item.month,
        entrada: Number(item.entrada),
        saida: Number(item.saida)
      })),
      expensesByCategory: expensesByCategory.map((item) => ({
        name: item.name,
        value: item.value
      })),
      reconciliationDaily: reconciliationDaily.map((item) => ({
        day: String(item.day),
        auto: item.auto,
        manual: item.manual
      })),
      aiActivity: aiLogs.map((item) => ({
        t: item.occurredAt.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit"
        }),
        type: item.status.toLowerCase(),
        text: item.action
      })),
      timeline: [
        { label: "Tempo economizado (mes)", value: "0h" },
        { label: "Economia operacional", value: "R$ 0" },
        {
          label: "Precisao IA",
          value: `${aiLogs.length ? Math.round((aiLogs.reduce((sum, item) => sum + item.confidence, 0) / aiLogs.length) * 100) : 0}%`
        },
        { label: "Operacoes no mes", value: operations.length.toLocaleString("pt-BR") }
      ],
      totals: {
        totalPayables: currency(totalPayables)
      },
      omie: {
        exported: omieSyncs.length,
        success: omieSuccess,
        error: omieError,
        blocked: omieBlocked,
        latest: omieSyncs.map((item) => ({
          id: item.id,
          status: item.status,
          externalId: item.externalId,
          syncedAt: item.syncedAt?.toISOString() ?? null,
          errorMessage: item.errorMessage
        }))
      },
      asaas: {
        charges: asaasChargeSyncs.length,
        paid: asaasPaid.length,
        overdue: asaasOverdue.length,
        netReceived: currency(asaasNetReceived),
        fees: currency(asaasFees),
        webhookEvents: asaasWebhookEvents.length,
        integrationErrors: asaasErrors
      }
    };
  });

  app.get("/executive/overview", async (request) => {
    const companyId = request.user.companyId;

    const [cashflow, dreEntries, insights, receivables, payables] = await Promise.all([
      prisma.cashflowPoint.findMany({ where: { companyId }, orderBy: { monthKey: "asc" } }),
      prisma.dreEntry.findMany({ where: { companyId } }),
      prisma.insight.findMany({ where: { companyId } }),
      prisma.accountReceivable.findMany({ where: { companyId } }),
      prisma.accountPayable.findMany({ where: { companyId } })
    ]);

    const revenue = receivables.reduce((sum, item) => sum + Number(item.amount), 0);
    const expense = payables.reduce((sum, item) => sum + Number(item.amount), 0);
    const latestEbitda = dreEntries.find((item) => item.label === "EBITDA");

    return {
      stats: {
        revenue,
        revenueDelta: "0%",
        ebitda: latestEbitda ? Number(latestEbitda.value) : 0,
        ebitdaDelta: "0%",
        expense,
        expenseDelta: "0%",
        delinquencyRate: "0%",
        delinquencyDelta: "0pp"
      },
      cashflow: cashflow.map((item) => ({
        month: item.month,
        entrada: Number(item.entrada),
        saida: Number(item.saida)
      })),
      dre: dreEntries.map((item) => ({
        l: item.label,
        v: Number(item.value),
        t: item.type,
        bold: item.bold,
        hl: item.highlight
      })),
      insights: insights.map((item) => ({
        c: item.tone,
        t: item.title,
        d: item.description
      }))
    };
  });

  app.get("/ai/overview", async (request) => {
    const companyId = request.user.companyId;
    const [automations, performancePoints, aiLogs] = await Promise.all([
      prisma.automation.findMany({ where: { companyId }, orderBy: { title: "asc" } }),
      prisma.performancePoint.findMany({ where: { companyId }, orderBy: { day: "asc" } }),
      prisma.aiLog.findMany({ where: { companyId } })
    ]);

    const avgConfidence = aiLogs.length
      ? Math.round((aiLogs.reduce((sum, item) => sum + item.confidence, 0) / aiLogs.length) * 1000) / 10
      : 0;

    return {
      health: {
        model: aiLogs.length ? "configured" : "not-configured",
        status: aiLogs.length ? "active" : "idle"
      },
      stats: {
        operationsToday: 0,
        accuracy: avgConfidence,
        monthlySavings: 0,
        timeSavedHours: 0,
        activeAutomations: automations.filter((item) => item.status === "ACTIVE").length,
        runningModels: 0
      },
      performance: performancePoints.map((item) => ({
        d: item.day,
        acc: item.accuracy,
        ops: item.ops
      })),
      automations: automations.map((item) => ({
        id: item.id,
        title: item.title,
        desc: item.description,
        runs: item.runs,
        accuracy: item.accuracy,
        status: item.status === "ACTIVE" ? "active" : "paused"
      }))
    };
  });
};

export default dashboardRoutes;
