import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../lib/prisma.js";

const monitoringRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/summary",
    {
      preHandler: app.authenticate
    },
    async (request) => {
      const company = await prisma.company.findUniqueOrThrow({
        where: { id: request.user.companyId }
      });

      const memoryUsage = process.memoryUsage();

      return {
        api: {
          uptimeSeconds: Math.round(process.uptime()),
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          latencyMs: company.latencyMs
        },
        application: {
          integrationsHealthy: company.integrationsHealthy,
          integrationsTotal: company.integrationsTotal,
          aiUptime: company.aiUptime
        }
      };
    }
  );
};

export default monitoringRoutes;
