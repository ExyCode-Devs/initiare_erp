import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  allocateLegalEntity,
  buildDraftPayload,
  buildOperationalBi,
  classifyReconciliationMovement,
  detectBillableServiceOrders,
  detectDueContracts
} from "../lib/advanced-ops.js";
import { prisma } from "../lib/prisma.js";

const allocationRuleSchema = z
  .object({
    strategy: z.enum(["MANUAL", "PERCENTAGE", "VALUE_BAND", "GROUP"]),
    legalEntityId: z.string().nullable().optional(),
    percentageMap: z.array(z.object({ legalEntityId: z.string(), percentage: z.number().nonnegative() })).optional(),
    valueBands: z.array(z.object({ legalEntityId: z.string(), min: z.number().nonnegative(), max: z.number().nullable() })).optional(),
    groupMap: z.array(z.object({ legalEntityId: z.string(), tag: z.string() })).optional(),
    monthlyCapMap: z.array(z.object({ legalEntityId: z.string(), cap: z.number().nonnegative(), used: z.number().nonnegative() })).optional()
  })
  .nullable()
  .optional();

const contractSnapshotSchema = z.object({
  originId: z.string().min(1),
  businessClientId: z.string().min(1),
  businessClientName: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().min(10),
  category: z.string().nullable(),
  description: z.string().min(1),
  scheduleReason: z.string().min(1),
  tags: z.array(z.string()).optional()
});

const serviceOrderSnapshotSchema = z.object({
  originId: z.string().min(1),
  businessClientId: z.string().min(1),
  businessClientName: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().min(10),
  category: z.string().nullable(),
  description: z.string().min(1),
  faturavel: z.boolean(),
  tags: z.array(z.string()).optional()
});

const movementSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["IN", "OUT"]),
  amount: z.number().positive(),
  description: z.string().min(1),
  occurredAt: z.string().min(10),
  suggestedPartyName: z.string().nullable().optional()
});

const advancedOpsRoutes: FastifyPluginAsync = async (app) => {
  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", protectedApp.authenticate);

    protectedApp.get("/advanced-ops/overview", async (request) => {
      const [drafts, receivables, reconciliationItems, clients, legalEntities] = await Promise.all([
        prisma.financialDraft.findMany({
          where: { companyId: request.user.companyId },
          orderBy: { createdAt: "desc" },
          take: 200
        }),
        prisma.accountReceivable.findMany({
          where: { companyId: request.user.companyId },
          orderBy: { createdAt: "desc" },
          take: 200
        }),
        prisma.reconciliationItem.findMany({
          where: { companyId: request.user.companyId },
          orderBy: { bankDate: "desc" },
          take: 100
        }),
        prisma.client.findMany({
          where: { companyId: request.user.companyId },
          orderBy: { name: "asc" },
          take: 20
        }),
        prisma.legalEntity.findMany({
          where: { companyId: request.user.companyId, active: true },
          orderBy: [{ isDefault: "desc" }, { legalName: "asc" }]
        })
      ]);

      const summary = buildOperationalBi({
        drafts: drafts.map((draft) => ({
          id: draft.id,
          createdAt: draft.createdAt,
          status: draft.status,
          partyName: draft.partyName,
          rawPayload: draft.rawPayload
        })),
        receivables: receivables.map((item) => ({
          id: item.id,
          amount: Number(item.amount),
          clientId: item.clientId,
          createdAt: item.createdAt,
          status: item.status
        })),
        reconciliationCount: reconciliationItems.length
      });

      return {
        summary,
        businessClients: clients.map((client) => ({
          id: client.id,
          name: client.name
        })),
        legalEntities: legalEntities.map((entity) => ({
          id: entity.id,
          legalName: entity.legalName,
          tradeName: entity.tradeName,
          isDefault: entity.isDefault
        })),
        latestDrafts: drafts.slice(0, 10).map((draft) => ({
          id: draft.id,
          partyName: draft.partyName,
          status: draft.status,
          sourceLabel: draft.sourceLabel,
          createdAt: draft.createdAt.toISOString()
        }))
      };
    });

    protectedApp.post(
      "/advanced-ops/contracts/generate-drafts",
      {
        preHandler: protectedApp.authorize(["ADMIN", "ANALYST"])
      },
      async (request) => {
        const payload = z
          .object({
            referenceDate: z.string().optional(),
            allocationRule: allocationRuleSchema,
            contracts: z.array(contractSnapshotSchema).min(1)
          })
          .parse(request.body);

        const [existingDrafts, legalEntities] = await Promise.all([
          prisma.financialDraft.findMany({
            where: {
              companyId: request.user.companyId
            },
            select: {
              rawPayload: true
            },
            orderBy: { createdAt: "desc" },
            take: 500
          }),
          prisma.legalEntity.findMany({
            where: { companyId: request.user.companyId, active: true },
            orderBy: [{ isDefault: "desc" }, { legalName: "asc" }]
          })
        ]);

        const dueContracts = detectDueContracts({
          contracts: payload.contracts,
          existingDrafts,
          referenceDate: payload.referenceDate ? new Date(payload.referenceDate) : new Date()
        });

        const created = [];
        for (const contract of dueContracts) {
          const allocation = allocateLegalEntity({
            amount: contract.amount,
            tags: contract.tags,
            legalEntities,
            rule: payload.allocationRule ?? null
          });
          const draft = await prisma.financialDraft.create({
            data: {
              companyId: request.user.companyId,
              ...buildDraftPayload({
                sourceLabel: "OMIE contract",
                originType: "omie_contract",
                originId: contract.originId,
                businessClientId: contract.businessClientId,
                businessClientName: contract.businessClientName,
                amount: contract.amount,
                dueDate: contract.dueDate,
                description: contract.description,
                category: contract.category,
                legalEntityId: allocation.legalEntityId,
                routeReason: `Allocated by ${allocation.strategy} strategy from contract engine`,
                evidence: [`contract:${contract.originId}`, contract.scheduleReason],
                extra: {
                  scheduleReason: contract.scheduleReason,
                  allocationStrategy: allocation.strategy,
                  contractSnapshot: contract
                }
              })
            }
          });
          created.push({
            id: draft.id,
            partyName: draft.partyName,
            amount: Number(draft.amount ?? 0)
          });
        }

        return {
          created,
          skipped: payload.contracts.length - created.length
        };
      }
    );

    protectedApp.post(
      "/advanced-ops/service-orders/generate-drafts",
      {
        preHandler: protectedApp.authorize(["ADMIN", "ANALYST"])
      },
      async (request) => {
        const payload = z
          .object({
            allocationRule: allocationRuleSchema,
            serviceOrders: z.array(serviceOrderSnapshotSchema).min(1)
          })
          .parse(request.body);

        const [existingDrafts, legalEntities] = await Promise.all([
          prisma.financialDraft.findMany({
            where: {
              companyId: request.user.companyId
            },
            select: {
              rawPayload: true
            },
            orderBy: { createdAt: "desc" },
            take: 500
          }),
          prisma.legalEntity.findMany({
            where: { companyId: request.user.companyId, active: true },
            orderBy: [{ isDefault: "desc" }, { legalName: "asc" }]
          })
        ]);

        const candidates = detectBillableServiceOrders({
          serviceOrders: payload.serviceOrders,
          existingDrafts
        });

        const created = [];
        for (const serviceOrder of candidates) {
          const allocation = allocateLegalEntity({
            amount: serviceOrder.amount,
            tags: serviceOrder.tags,
            legalEntities,
            rule: payload.allocationRule ?? null
          });
          const draft = await prisma.financialDraft.create({
            data: {
              companyId: request.user.companyId,
              ...buildDraftPayload({
                sourceLabel: "OMIE service order",
                originType: "omie_os",
                originId: serviceOrder.originId,
                businessClientId: serviceOrder.businessClientId,
                businessClientName: serviceOrder.businessClientName,
                amount: serviceOrder.amount,
                dueDate: serviceOrder.dueDate,
                description: serviceOrder.description,
                category: serviceOrder.category,
                legalEntityId: allocation.legalEntityId,
                routeReason: `Allocated by ${allocation.strategy} strategy from service-order engine`,
                evidence: [`service-order:${serviceOrder.originId}`],
                extra: {
                  allocationStrategy: allocation.strategy,
                  serviceOrderSnapshot: serviceOrder
                }
              })
            }
          });
          created.push({
            id: draft.id,
            partyName: draft.partyName,
            amount: Number(draft.amount ?? 0)
          });
        }

        return {
          created,
          skipped: payload.serviceOrders.length - created.length
        };
      }
    );

    protectedApp.post(
      "/advanced-ops/reconciliation/create-draft",
      {
        preHandler: protectedApp.authorize(["ADMIN", "ANALYST"])
      },
      async (request) => {
        const payload = z
          .object({
            movement: movementSchema,
            candidates: z.array(
              z.object({
                id: z.string().min(1),
                amount: z.number().positive(),
                description: z.string().min(1),
                occurredAt: z.string().nullable().optional()
              })
            ),
            knownFeeLabels: z.array(z.string()).optional(),
            legalEntityId: z.string().nullable().optional()
          })
          .parse(request.body);

        const classification = classifyReconciliationMovement({
          movement: payload.movement,
          candidates: payload.candidates,
          knownFeeLabels: payload.knownFeeLabels
        });
        if (classification.classification === "auto_reconciled" || classification.classification === "duplicate") {
          return {
            created: null,
            classification
          };
        }

        const draft = await prisma.financialDraft.create({
          data: {
            companyId: request.user.companyId,
            ...buildDraftPayload({
              sourceLabel: "Reconciliation bridge",
              originType: "reconciliation",
              originId: payload.movement.id,
              businessClientId: null,
              businessClientName: payload.movement.suggestedPartyName ?? "Reconciliation review",
              amount: payload.movement.amount,
              dueDate: payload.movement.occurredAt,
              description: payload.movement.description,
              category: classification.classification === "fee" ? "Taxas" : "A classificar",
              legalEntityId: payload.legalEntityId ?? null,
              routeReason: "Created from unmatched reconciliation movement",
              evidence: [`movement:${payload.movement.id}`],
              extra: {
                movement: payload.movement,
                classification
              }
            })
          }
        });

        return {
          created: {
            id: draft.id,
            status: draft.status
          },
          classification
        };
      }
    );

    protectedApp.post(
      "/advanced-ops/portal/access-token",
      {
        preHandler: protectedApp.authorize(["ADMIN", "ANALYST"])
      },
      async (request) => {
        const payload = z
          .object({
            clientId: z.string().min(1),
            expiresInHours: z.number().int().positive().max(168).default(24)
          })
          .parse(request.body);

        const client = await prisma.client.findFirstOrThrow({
          where: {
            id: payload.clientId,
            companyId: request.user.companyId
          }
        });

        const token = await app.jwt.sign(
          {
            sub: `portal:${client.id}`,
            role: "VIEWER",
            companyId: request.user.companyId,
            email: `${client.id}@portal.local`,
            name: client.name,
            tokenType: "portal",
            clientId: client.id
          },
          {
            expiresIn: `${payload.expiresInHours}h`
          }
        );

        return {
          token,
          client: {
            id: client.id,
            name: client.name
          }
        };
      }
    );
  });

  app.get("/portal/overview", async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401);
      return { message: "Unauthorized" };
    }

    if (request.user.tokenType !== "portal" || !request.user.clientId) {
      reply.code(403);
      return { message: "Forbidden" };
    }

    const [client, receivables] = await Promise.all([
      prisma.client.findFirstOrThrow({
        where: {
          id: request.user.clientId,
          companyId: request.user.companyId
        }
      }),
      prisma.accountReceivable.findMany({
        where: {
          companyId: request.user.companyId,
          clientId: request.user.clientId
        },
        orderBy: { dueDate: "desc" },
        take: 100
      })
    ]);

    return {
      client: {
        id: client.id,
        name: client.name
      },
      stats: {
        totalReceivables: receivables.length,
        totalVolume: receivables.reduce((sum, item) => sum + Number(item.amount), 0)
      },
      items: receivables.map((item) => ({
        id: item.id,
        amount: Number(item.amount),
        dueDate: item.dueDate.toISOString(),
        status: item.status,
        source: item.source,
        channel: item.channel
      }))
    };
  });
};

export default advancedOpsRoutes;
