import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";

const currency = (value: number) => value;

const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/dashboard/overview", async (request) => {
    const companyId = request.user.companyId;

    const [
      company,
      payableItems,
      receivableItems,
      operations,
      exceptions,
      aiLogs,
      cashflow,
      expensesByCategory,
      reconciliationDaily
    ] = await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
      prisma.accountPayable.findMany({ where: { companyId } }),
      prisma.accountReceivable.findMany({ where: { companyId } }),
      prisma.operation.findMany({ where: { companyId }, orderBy: { dueDate: "desc" }, take: 42 }),
      prisma.exceptionItem.findMany({ where: { companyId }, orderBy: { updatedAt: "desc" } }),
      prisma.aiLog.findMany({ where: { companyId }, orderBy: { occurredAt: "desc" }, take: 8 }),
      prisma.cashflowPoint.findMany({ where: { companyId }, orderBy: { monthKey: "asc" } }),
      prisma.expenseCategory.findMany({ where: { companyId } }),
      prisma.dailyReconciliationPoint.findMany({ where: { companyId }, orderBy: { day: "asc" } })
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

    return {
      hero: {
        greetingName: request.user.name.split(" ")[0],
        cycleLabel: company.aiCycleLabel,
        processedToday: operations.length,
        openExceptions: exceptionCount,
        uptime: company.aiUptime,
        integrationsHealthy: company.integrationsHealthy,
        integrationsTotal: company.integrationsTotal,
        latencyMs: company.latencyMs
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
        { label: "Tempo economizado (mes)", value: `${company.timeSavedHours}h` },
        { label: "Economia operacional", value: `R$ ${Number(company.operationalSavings).toLocaleString("pt-BR")}` },
        {
          label: "Precisao IA",
          value: `${aiLogs.length ? Math.round((aiLogs.reduce((sum, item) => sum + item.confidence, 0) / aiLogs.length) * 100) : 0}%`
        },
        { label: "Operacoes no mes", value: company.monthlyOperations.toLocaleString("pt-BR") }
      ],
      totals: {
        totalPayables: currency(totalPayables)
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
        revenueDelta: "+18.4%",
        ebitda: latestEbitda ? Number(latestEbitda.value) : 0,
        ebitdaDelta: "+22.1%",
        expense,
        expenseDelta: "+8.2%",
        delinquencyRate: "2.1%",
        delinquencyDelta: "-0.6pp"
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
    const [automations, performancePoints, company, aiLogs] = await Promise.all([
      prisma.automation.findMany({ where: { companyId }, orderBy: { title: "asc" } }),
      prisma.performancePoint.findMany({ where: { companyId }, orderBy: { day: "asc" } }),
      prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
      prisma.aiLog.findMany({ where: { companyId } })
    ]);

    const avgConfidence = aiLogs.length
      ? Math.round((aiLogs.reduce((sum, item) => sum + item.confidence, 0) / aiLogs.length) * 1000) / 10
      : 0;

    return {
      health: {
        model: "veridia-finance-v3.2",
        status: "saudavel"
      },
      stats: {
        operationsToday: company.monthlyOperations,
        accuracy: avgConfidence,
        monthlySavings: Number(company.operationalSavings),
        timeSavedHours: company.timeSavedHours,
        activeAutomations: automations.filter((item) => item.status === "ACTIVE").length,
        runningModels: 6
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
