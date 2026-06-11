import type { FastifyPluginAsync } from "fastify";
import { normalizeAutomationSettings } from "../lib/automation-settings.js";
import { prisma } from "../lib/prisma.js";

const automationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/automation/summary", async (request) => {
    const companyId = request.user.companyId;
    const [
      company,
      mailboxes,
      emails,
      drafts,
      jobRuns,
      totalEmails,
      processed,
      errorCount,
      pendingReview,
      approved,
      rejected,
      lowConfidence,
    ] = await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { automationSettings: true },
      }),
      prisma.mailboxAccount.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          active: true,
          lastSyncAt: true,
          lastError: true,
        },
      }),
      prisma.inboundEmail.findMany({
        where: { companyId },
        orderBy: { receivedAt: "desc" },
        take: 10,
      }),
      prisma.financialDraft.findMany({
        where: { companyId },
      }),
      prisma.processingJobRun.findMany({
        where: { companyId },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
      prisma.inboundEmail.count({
        where: { companyId },
      }),
      prisma.inboundEmail.count({
        where: {
          companyId,
          status: {
            in: ["PROCESSADO", "AGUARDANDO_VALIDACAO", "APROVADO"],
          },
        },
      }),
      prisma.processingJobRun.count({
        where: {
          companyId,
          status: "FAILED",
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
    const settings = normalizeAutomationSettings(company.automationSettings);
    const activeMailboxes = mailboxes.filter((item) => item.active);
    const latestSuccessfulSync = activeMailboxes
      .map((item) => item.lastSyncAt)
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

    return {
      stats: {
        totalEmails,
        processed,
        errorCount,
        pendingReview,
        approved,
        rejected,
        lowConfidence,
        volume,
      },
      runtime: {
        emailIngestEnabled: settings.emailIngestEnabled,
        batchProcessingEnabled: settings.batchProcessingEnabled,
        autoSyncMailboxes: settings.autoSyncMailboxes,
        defaultEnvironment: settings.defaultEnvironment,
        maxEmailsPerRun: settings.maxEmailsPerRun,
        batchIntervalMinutes: settings.batchIntervalMinutes,
        totalMailboxes: mailboxes.length,
        activeMailboxes: activeMailboxes.length,
        unhealthyMailboxes: activeMailboxes.filter((item) => Boolean(item.lastError)).length,
        latestSuccessfulSyncAt: latestSuccessfulSync?.toISOString() ?? null,
      },
      latestEmails: emails.map((item) => ({
        id: item.id,
        sender: item.sender,
        subject: item.subject,
        status: item.status,
        receivedAt: item.receivedAt.toISOString(),
      })),
      latestRuns: jobRuns.map((item) => ({
        id: item.id,
        runType: item.runType,
        status: item.status,
        fetchedCount: item.fetchedCount,
        processedCount: item.processedCount,
        errorCount: item.errorCount,
        startedAt: item.startedAt.toISOString(),
        finishedAt: item.finishedAt?.toISOString() ?? null,
      })),
    };
  });
};

export default automationRoutes;
