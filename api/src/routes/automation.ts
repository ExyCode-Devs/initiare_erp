import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";

const automationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/automation/summary", async (request) => {
    const companyId = request.user.companyId;
    const [
      events,
      drafts,
      gatewayRuns,
      totalEvents,
      processed,
      errorCount,
      pendingReview,
      approved,
      rejected,
      lowConfidence,
    ] = await Promise.all([
      prisma.aiEventSource.findMany({
        where: { companyId },
        orderBy: { receivedAt: "desc" },
        take: 10,
      }),
      prisma.financialDraft.findMany({
        where: { companyId },
      }),
      prisma.aiGatewayRun.findMany({
        where: { companyId },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
      prisma.aiEventSource.count({
        where: { companyId },
      }),
      prisma.aiEventSource.count({
        where: {
          companyId,
          status: "PROCESSED",
        },
      }),
      prisma.aiGatewayRun.count({
        where: {
          companyId,
          status: "ERRO",
        },
      }),
      prisma.financialDraft.count({
        where: {
          companyId,
          status: "PENDENTE_REVISAO",
        },
      }),
      prisma.financialDraft.count({
        where: {
          companyId,
          status: "APROVADO",
        },
      }),
      prisma.financialDraft.count({
        where: {
          companyId,
          status: "REJEITADO",
        },
      }),
      prisma.financialDraft.count({
        where: {
          companyId,
          confidenceBand: "BAIXA",
        },
      }),
    ]);

    const volume = drafts
      .filter((item) => item.status !== "REJEITADO")
      .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

    return {
      stats: {
        totalEmails: totalEvents,
        processed,
        errorCount,
        pendingReview,
        approved,
        rejected,
        lowConfidence,
        volume,
      },
      latestEmails: events.map((item) => ({
        id: item.id,
        sender: item.sender ?? item.channel,
        subject: item.subject ?? item.summary ?? item.channel,
        status: item.status,
        receivedAt: item.receivedAt.toISOString(),
      })),
      latestRuns: gatewayRuns.map((item) => ({
        id: item.id,
        runType: item.provider,
        status: item.status === "SUCESSO" ? "COMPLETED" : item.status === "ERRO" ? "FAILED" : "RUNNING",
        fetchedCount: 1,
        processedCount: item.status === "SUCESSO" ? 1 : 0,
        errorCount: item.status === "ERRO" ? 1 : 0,
        startedAt: item.startedAt.toISOString(),
        finishedAt: item.completedAt?.toISOString() ?? null,
      })),
    };
  });
};

export default automationRoutes;
