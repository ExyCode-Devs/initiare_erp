import { ErpEnvironment, ErpHealthStatus, ErpProvider, ErpSyncEntityType } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AsaasClient } from "../lib/asaas-client.js";
import {
  findAsaasConnectionByWebhookToken,
  listAsaasConnections,
  markAsaasConnectionHealth,
  resolveAsaasConnection,
  saveAsaasConnection
} from "../lib/asaas-connections.js";
import { processAsaasWebhook } from "../lib/asaas-webhook-service.js";
import { mapAsaasReceivableRow, syncAsaasData } from "../lib/asaas-sync-service.js";
import { prisma } from "../lib/prisma.js";

const environmentSchema = z.enum(["SANDBOX", "PRODUCTION"]);
const legalEntityBodySchema = z.object({
  legalEntityId: z.string().min(1)
});

function pickHeader(headers: Record<string, unknown>, key: string) {
  const direct = headers[key];
  if (typeof direct === "string") {
    return direct;
  }

  const lower = headers[key.toLowerCase()];
  return typeof lower === "string" ? lower : null;
}

const asaasRoutes: FastifyPluginAsync = async (app) => {
  app.post("/integrations/asaas/webhook/:environment", async (request, reply) => {
    const params = z.object({ environment: environmentSchema }).parse(request.params);
    const payload = z.record(z.string(), z.unknown()).parse(request.body ?? {});

    try {
      const webhookToken = pickHeader(request.headers as Record<string, unknown>, "asaas-access-token");
      if (!webhookToken) {
        reply.code(401).send({ message: "Missing ASAAS webhook token" });
        return;
      }
      const connection = await findAsaasConnectionByWebhookToken(params.environment as ErpEnvironment, webhookToken);
      if (!connection) {
        reply.code(401).send({ message: "Invalid ASAAS webhook token" });
        return;
      }

      const result = await processAsaasWebhook({
        companyId: connection.companyId,
        legalEntityId: connection.legalEntityId,
        environment: params.environment as ErpEnvironment,
        headers: request.headers as Record<string, unknown>,
        payload
      });

      reply.code(200).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ASAAS webhook rejected";
      const statusCode = /token/i.test(message) ? 401 : 400;
      reply.code(statusCode).send({ message });
    }
  });

  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", protectedApp.authenticate);

    protectedApp.get("/settings/integrations/asaas", async (request) => {
      const connections = await listAsaasConnections(request.user.companyId);

      return {
        provider: "ASAAS",
        environments: connections
      };
    });

    protectedApp.put(
      "/settings/integrations/asaas/:environment",
      {
        preHandler: protectedApp.authorize(["ADMIN"])
      },
      async (request) => {
        const params = z.object({ environment: environmentSchema }).parse(request.params);
        const payload = z
          .object({
            legalEntityId: z.string().min(1),
            apiKey: z.string().trim().optional().nullable(),
            webhookAuthToken: z.string().trim().optional().nullable(),
            baseUrl: z.string().trim().optional().nullable(),
            enabled: z.boolean().default(true)
          })
          .parse(request.body);

        const record = await saveAsaasConnection({
          companyId: request.user.companyId,
          legalEntityId: payload.legalEntityId,
          environment: params.environment as ErpEnvironment,
          apiKey: payload.apiKey ?? null,
          webhookAuthToken: payload.webhookAuthToken ?? null,
          baseUrl: payload.baseUrl ?? null,
          enabled: payload.enabled
        });

        return {
          id: record.id,
          environment: record.environment,
          baseUrl: record.baseUrl,
          enabled: record.enabled,
          hasApiKey: Boolean(record.appKeyCipher),
          hasWebhookToken: Boolean(record.webhookAuthTokenCipher)
        };
      }
    );

    protectedApp.post(
      "/settings/integrations/asaas/:environment/test",
      {
        preHandler: protectedApp.authorize(["ADMIN"])
      },
      async (request) => {
        const params = z.object({ environment: environmentSchema }).parse(request.params);
        const payload = legalEntityBodySchema.parse(request.body ?? {});
        const connection = await resolveAsaasConnection(
          request.user.companyId,
          payload.legalEntityId,
          params.environment as ErpEnvironment
        );
        const client = new AsaasClient(connection);

        try {
          const customers = await client.listCustomers({
            companyId: request.user.companyId,
            connectionId: connection.id,
            triggeredByUserId: request.user.sub
          });

          await markAsaasConnectionHealth({
            connectionId: connection.id,
            status: ErpHealthStatus.HEALTHY
          });

          return {
            ok: true,
            environment: connection.environment,
            baseUrl: connection.baseUrl,
            customerCount: customers.data?.length ?? 0
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "ASAAS connection test failed";
          await markAsaasConnectionHealth({
            connectionId: connection.id,
            status: ErpHealthStatus.ERROR,
            error: message
          });
          throw error;
        }
      }
    );

    protectedApp.post(
      "/settings/integrations/asaas/:environment/sync",
      {
        preHandler: protectedApp.authorize(["ADMIN"])
      },
      async (request) => {
        const params = z.object({ environment: environmentSchema }).parse(request.params);
        const payload = legalEntityBodySchema.parse(request.body ?? {});

        return syncAsaasData({
          companyId: request.user.companyId,
          legalEntityId: payload.legalEntityId,
          environment: params.environment as ErpEnvironment,
          triggeredByUserId: request.user.sub
        });
      }
    );

    protectedApp.get(
      "/asaas/payments",
      {
        preHandler: protectedApp.authorize(["ADMIN", "ANALYST"])
      },
      async (request) => {
        const records = await prisma.erpSyncRecord.findMany({
          where: {
            companyId: request.user.companyId,
            provider: ErpProvider.ASAAS,
            entityType: ErpSyncEntityType.CHARGE
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 100
        });

        const latestWebhooks = await prisma.erpWebhookEvent.findMany({
          where: {
            companyId: request.user.companyId,
            provider: ErpProvider.ASAAS
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 20
        });

        const latestWebhook = latestWebhooks[0] ?? null;

        const items = records.map((record) => {
          const normalized = (record.requestPayload ?? {}) as Record<string, unknown>;
          return mapAsaasReceivableRow({
            syncId: record.id,
            charge: {
              id: String(normalized.id ?? record.externalId ?? record.internalId),
              customerId: normalized.customerId == null ? null : String(normalized.customerId),
              customerName: normalized.customerName == null ? null : String(normalized.customerName),
              status: String(normalized.status ?? record.status),
              description: normalized.description == null ? null : String(normalized.description),
              billingType: normalized.billingType == null ? null : String(normalized.billingType),
              grossValue: Number(normalized.grossValue ?? 0),
              netValue: normalized.netValue == null ? null : Number(normalized.netValue),
              feeValue: normalized.feeValue == null ? null : Number(normalized.feeValue),
              dueDate: normalized.dueDate == null ? null : String(normalized.dueDate),
              paymentDate: normalized.paymentDate == null ? null : String(normalized.paymentDate),
              invoiceUrl: normalized.invoiceUrl == null ? null : String(normalized.invoiceUrl)
            },
            webhookStatus: latestWebhook?.status ?? null,
            webhookError: latestWebhook?.errorMessage ?? null
          });
        });

        const paid = items.filter((item) => /RECEIVED|CONFIRMED|PAID/i.test(item.status));
        const overdue = items.filter((item) => /OVERDUE/i.test(item.status));

        return {
          stats: {
            charges: items.length,
            paid: paid.length,
            overdue: overdue.length,
            netReceived: paid.reduce((sum, item) => sum + Number(item.netAmount ?? 0), 0),
            fees: items.reduce((sum, item) => sum + Number(item.fee ?? 0), 0),
            webhookEvents: latestWebhooks.length,
            integrationErrors: latestWebhooks.filter((item) => item.status === "ERROR").length
          },
          items,
          latestWebhook:
            latestWebhook == null
              ? null
              : {
                  id: latestWebhook.id,
                  eventType: latestWebhook.eventType,
                  status: latestWebhook.status,
                  errorMessage: latestWebhook.errorMessage,
                  createdAt: latestWebhook.createdAt.toISOString()
                }
        };
      }
    );

    protectedApp.get(
      "/asaas/webhooks",
      {
        preHandler: protectedApp.authorize(["ADMIN", "ANALYST"])
      },
      async (request) => {
        const items = await prisma.erpWebhookEvent.findMany({
          where: {
            companyId: request.user.companyId,
            provider: ErpProvider.ASAAS
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 50
        });

        return {
          items: items.map((item) => ({
            id: item.id,
            environment: item.environment,
            externalEventId: item.externalEventId,
            eventType: item.eventType,
            status: item.status,
            errorMessage: item.errorMessage,
            processedAt: item.processedAt?.toISOString() ?? null,
            createdAt: item.createdAt.toISOString()
          }))
        };
      }
    );
  });
};

export default asaasRoutes;
