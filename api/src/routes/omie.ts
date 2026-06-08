import { ErpEnvironment, ErpHealthStatus } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { OmieClient } from "../lib/omie-client.js";
import { syncOmieCatalogs } from "../lib/omie-catalog-sync-service.js";
import {
  listOmieConnections,
  markOmieConnectionHealth,
  resolveOmieConnection,
  saveOmieConnection
} from "../lib/omie-connections.js";

const environmentSchema = z.enum(["HOMOLOG", "PRODUCTION"]);

const omieRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/settings/integrations/omie", async (request) => {
    const connections = await listOmieConnections(request.user.companyId);

    return {
      provider: "OMIE",
      environments: connections
    };
  });

  app.put(
    "/settings/integrations/omie/:environment",
    {
      preHandler: app.authorize(["ADMIN"])
    },
    async (request) => {
      const params = z.object({ environment: environmentSchema }).parse(request.params);
      const payload = z
        .object({
          appKey: z.string().trim().optional().nullable(),
          appSecret: z.string().trim().optional().nullable(),
          baseUrl: z.string().trim().optional().nullable(),
          enabled: z.boolean().default(true)
        })
        .parse(request.body);

      const record = await saveOmieConnection({
        companyId: request.user.companyId,
        environment: params.environment as ErpEnvironment,
        appKey: payload.appKey ?? null,
        appSecret: payload.appSecret ?? null,
        baseUrl: payload.baseUrl ?? null,
        enabled: payload.enabled
      });

      return {
        id: record.id,
        environment: record.environment,
        baseUrl: record.baseUrl,
        enabled: record.enabled,
        hasAppKey: Boolean(record.appKeyCipher),
        hasAppSecret: Boolean(record.appSecretCipher)
      };
    }
  );

  app.post(
    "/settings/integrations/omie/:environment/test",
    {
      preHandler: app.authorize(["ADMIN"])
    },
    async (request) => {
      const params = z.object({ environment: environmentSchema }).parse(request.params);
      const connection = await resolveOmieConnection(request.user.companyId, params.environment as ErpEnvironment);
      const client = new OmieClient(connection);

      try {
        const categories = await client.listCategories({
          companyId: request.user.companyId,
          connectionId: connection.id,
          triggeredByUserId: request.user.sub
        });

        await markOmieConnectionHealth({
          connectionId: connection.id,
          status: ErpHealthStatus.HEALTHY
        });

        return {
          ok: true,
          environment: connection.environment,
          baseUrl: connection.baseUrl,
          categoryCount: categories.categoria_cadastro?.length ?? 0
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "OMIE connection test failed";
        await markOmieConnectionHealth({
          connectionId: connection.id,
          status: ErpHealthStatus.ERROR,
          error: message
        });
        throw error;
      }
    }
  );

  app.post(
    "/settings/integrations/omie/:environment/sync-catalog",
    {
      preHandler: app.authorize(["ADMIN"])
    },
    async (request) => {
      const params = z.object({ environment: environmentSchema }).parse(request.params);

      return syncOmieCatalogs({
        companyId: request.user.companyId,
        environment: params.environment as ErpEnvironment,
        triggeredByUserId: request.user.sub
      });
    }
  );
};

export default omieRoutes;
