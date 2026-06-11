import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  allocateLegalEntity,
  buildDraftPayload,
  buildOperationalBi,
  classifyReconciliationMovement,
  detectBillableServiceOrders,
  detectDueContracts,
  type AllocationRuleInput
} from "../lib/advanced-ops.js";
import { prisma } from "../lib/prisma.js";
import { toNullablePrismaJson } from "../lib/prisma-json.js";

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
  businessClientName: z.string().min(1).optional(),
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
  businessClientName: z.string().min(1).optional(),
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

function decodeAllocationRule(rule: {
  strategy: "MANUAL" | "PERCENTAGE" | "VALUE_BAND" | "GROUP";
  legalEntityId: string | null;
  percentageMap: unknown;
  valueBands: unknown;
  groupMap: unknown;
  monthlyCapMap: unknown;
} | null): AllocationRuleInput | null {
  if (!rule) {
    return null;
  }

  return {
    strategy: rule.strategy,
    legalEntityId: rule.legalEntityId,
    percentageMap: Array.isArray(rule.percentageMap) ? (rule.percentageMap as AllocationRuleInput["percentageMap"]) : undefined,
    valueBands: Array.isArray(rule.valueBands) ? (rule.valueBands as AllocationRuleInput["valueBands"]) : undefined,
    groupMap: Array.isArray(rule.groupMap) ? (rule.groupMap as AllocationRuleInput["groupMap"]) : undefined,
    monthlyCapMap: Array.isArray(rule.monthlyCapMap) ? (rule.monthlyCapMap as AllocationRuleInput["monthlyCapMap"]) : undefined
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const advancedOpsRoutes: FastifyPluginAsync = async (app) => {
  app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", protectedApp.authenticate);

    protectedApp.get("/advanced-ops/overview", async (request) => {
      const [drafts, receivables, reconciliationItems, businessClients, legalEntities] = await Promise.all([
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
        prisma.businessClient.findMany({
          where: { companyId: request.user.companyId, active: true },
          include: {
            client: true,
            legalEntities: {
              include: {
                legalEntity: true
              }
            },
            allocationRules: {
              where: { active: true },
              orderBy: { updatedAt: "desc" },
              take: 1
            }
          },
          orderBy: { name: "asc" }
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
        businessClients: businessClients.map((businessClient) => ({
          id: businessClient.id,
          name: businessClient.name,
          linkedClientId: businessClient.clientId,
          linkedClientName: businessClient.client?.name ?? null,
          allocationRule: businessClient.allocationRules[0]
            ? {
                id: businessClient.allocationRules[0].id,
                strategy: businessClient.allocationRules[0].strategy,
                legalEntityId: businessClient.allocationRules[0].legalEntityId
              }
            : null,
          legalEntities: businessClient.legalEntities.map((item) => ({
            id: item.legalEntity.id,
            legalName: item.legalEntity.legalName,
            tradeName: item.legalEntity.tradeName,
            percentage: item.percentage,
            monthlyCap: item.monthlyCap ? Number(item.monthlyCap) : null
          }))
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
      "/advanced-ops/business-clients",
      {
        preHandler: protectedApp.authorize(["ADMIN", "ANALYST"])
      },
      async (request) => {
        const payload = z
          .object({
            clientId: z.string().nullable().optional(),
            name: z.string().min(2),
            externalCode: z.string().nullable().optional(),
            legalEntityIds: z.array(z.string()).default([])
          })
          .parse(request.body);

        const businessClient = await prisma.businessClient.create({
          data: {
            companyId: request.user.companyId,
            clientId: payload.clientId ?? null,
            name: payload.name,
            externalCode: payload.externalCode ?? null
          }
        });

        if (payload.legalEntityIds.length) {
          await prisma.businessClientLegalEntity.createMany({
            data: payload.legalEntityIds.map((legalEntityId, index) => ({
              companyId: request.user.companyId,
              businessClientId: businessClient.id,
              legalEntityId,
              priority: index
            }))
          });
        }

        return {
          id: businessClient.id,
          name: businessClient.name
        };
      }
    );

    protectedApp.put(
      "/advanced-ops/business-clients/:id/allocation-rule",
      {
        preHandler: protectedApp.authorize(["ADMIN", "ANALYST"])
      },
      async (request) => {
        const params = z.object({ id: z.string().min(1) }).parse(request.params);
        const payload = z.object({ rule: allocationRuleSchema }).parse(request.body);

        await prisma.businessClient.findFirstOrThrow({
          where: {
            id: params.id,
            companyId: request.user.companyId
          }
        });

        if (!payload.rule) {
          return { rule: null };
        }

        const existing = await prisma.allocationRule.findFirst({
          where: {
            companyId: request.user.companyId,
            businessClientId: params.id,
            active: true
          },
          orderBy: { updatedAt: "desc" }
        });

        const rule = existing
          ? await prisma.allocationRule.update({
              where: { id: existing.id },
              data: {
                strategy: payload.rule.strategy,
                legalEntityId: payload.rule.legalEntityId ?? null,
                percentageMap: payload.rule.percentageMap ? toNullablePrismaJson(payload.rule.percentageMap) : Prisma.JsonNull,
                valueBands: payload.rule.valueBands ? toNullablePrismaJson(payload.rule.valueBands) : Prisma.JsonNull,
                groupMap: payload.rule.groupMap ? toNullablePrismaJson(payload.rule.groupMap) : Prisma.JsonNull,
                monthlyCapMap: payload.rule.monthlyCapMap ? toNullablePrismaJson(payload.rule.monthlyCapMap) : Prisma.JsonNull
              }
            })
          : await prisma.allocationRule.create({
              data: {
                companyId: request.user.companyId,
                businessClientId: params.id,
                strategy: payload.rule.strategy,
                legalEntityId: payload.rule.legalEntityId ?? null,
                percentageMap: payload.rule.percentageMap ? toNullablePrismaJson(payload.rule.percentageMap) : Prisma.JsonNull,
                valueBands: payload.rule.valueBands ? toNullablePrismaJson(payload.rule.valueBands) : Prisma.JsonNull,
                groupMap: payload.rule.groupMap ? toNullablePrismaJson(payload.rule.groupMap) : Prisma.JsonNull,
                monthlyCapMap: payload.rule.monthlyCapMap ? toNullablePrismaJson(payload.rule.monthlyCapMap) : Prisma.JsonNull
              }
            });

        return {
          rule: {
            id: rule.id,
            strategy: rule.strategy,
            legalEntityId: rule.legalEntityId
          }
        };
      }
    );

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

        const businessClientIds = [...new Set(payload.contracts.map((contract) => contract.businessClientId))];
        const [existingDrafts, legalEntities, businessClients, rules] = await Promise.all([
          prisma.financialDraft.findMany({
            where: { companyId: request.user.companyId },
            select: { rawPayload: true },
            orderBy: { createdAt: "desc" },
            take: 500
          }),
          prisma.legalEntity.findMany({
            where: { companyId: request.user.companyId, active: true },
            orderBy: [{ isDefault: "desc" }, { legalName: "asc" }]
          }),
          prisma.businessClient.findMany({
            where: {
              companyId: request.user.companyId,
              id: { in: businessClientIds }
            }
          }),
          prisma.allocationRule.findMany({
            where: {
              companyId: request.user.companyId,
              businessClientId: { in: businessClientIds },
              active: true
            },
            orderBy: { updatedAt: "desc" }
          })
        ]);

        const businessClientMap = new Map(businessClients.map((item) => [item.id, item]));
        const ruleMap = new Map<string, AllocationRuleInput>();
        for (const rule of rules) {
          if (!ruleMap.has(rule.businessClientId)) {
            const decoded = decodeAllocationRule(rule);
            if (decoded) {
              ruleMap.set(rule.businessClientId, decoded);
            }
          }
        }

        const dueContracts = detectDueContracts({
          contracts: payload.contracts,
          existingDrafts,
          referenceDate: payload.referenceDate ? new Date(payload.referenceDate) : new Date()
        });

        const created = [];
        for (const contract of dueContracts) {
          const businessClient = businessClientMap.get(contract.businessClientId);
          if (!businessClient) {
            continue;
          }
          const allocation = allocateLegalEntity({
            amount: contract.amount,
            tags: contract.tags,
            legalEntities,
            rule: payload.allocationRule ?? ruleMap.get(contract.businessClientId) ?? null
          });
          const draft = await prisma.financialDraft.create({
            data: {
              companyId: request.user.companyId,
              ...buildDraftPayload({
                sourceLabel: "OMIE contract",
                originType: "omie_contract",
                originId: contract.originId,
                businessClientId: businessClient.id,
                businessClientName: contract.businessClientName ?? businessClient.name,
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

        const businessClientIds = [...new Set(payload.serviceOrders.map((item) => item.businessClientId))];
        const [existingDrafts, legalEntities, businessClients, rules] = await Promise.all([
          prisma.financialDraft.findMany({
            where: { companyId: request.user.companyId },
            select: { rawPayload: true },
            orderBy: { createdAt: "desc" },
            take: 500
          }),
          prisma.legalEntity.findMany({
            where: { companyId: request.user.companyId, active: true },
            orderBy: [{ isDefault: "desc" }, { legalName: "asc" }]
          }),
          prisma.businessClient.findMany({
            where: {
              companyId: request.user.companyId,
              id: { in: businessClientIds }
            }
          }),
          prisma.allocationRule.findMany({
            where: {
              companyId: request.user.companyId,
              businessClientId: { in: businessClientIds },
              active: true
            },
            orderBy: { updatedAt: "desc" }
          })
        ]);

        const businessClientMap = new Map(businessClients.map((item) => [item.id, item]));
        const ruleMap = new Map<string, AllocationRuleInput>();
        for (const rule of rules) {
          if (!ruleMap.has(rule.businessClientId)) {
            const decoded = decodeAllocationRule(rule);
            if (decoded) {
              ruleMap.set(rule.businessClientId, decoded);
            }
          }
        }

        const candidates = detectBillableServiceOrders({
          serviceOrders: payload.serviceOrders,
          existingDrafts
        });

        const created = [];
        for (const serviceOrder of candidates) {
          const businessClient = businessClientMap.get(serviceOrder.businessClientId);
          if (!businessClient) {
            continue;
          }
          const allocation = allocateLegalEntity({
            amount: serviceOrder.amount,
            tags: serviceOrder.tags,
            legalEntities,
            rule: payload.allocationRule ?? ruleMap.get(serviceOrder.businessClientId) ?? null
          });
          const draft = await prisma.financialDraft.create({
            data: {
              companyId: request.user.companyId,
              ...buildDraftPayload({
                sourceLabel: "OMIE service order",
                originType: "omie_os",
                originId: serviceOrder.originId,
                businessClientId: businessClient.id,
                businessClientName: serviceOrder.businessClientName ?? businessClient.name,
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
            businessClientId: z.string().min(1),
            expiresInHours: z.number().int().positive().max(168).default(24),
            label: z.string().min(2).default("Portal access")
          })
          .parse(request.body);

        const businessClient = await prisma.businessClient.findFirstOrThrow({
          where: {
            id: payload.businessClientId,
            companyId: request.user.companyId,
            active: true
          }
        });

        const portalAccess = await prisma.portalAccess.create({
          data: {
            companyId: request.user.companyId,
            businessClientId: businessClient.id,
            label: payload.label,
            tokenHash: `pending:${Date.now()}:${businessClient.id}`,
            expiresAt: new Date(Date.now() + payload.expiresInHours * 60 * 60 * 1000)
          }
        });

        const token = await app.jwt.sign(
          {
            sub: `portal:${portalAccess.id}`,
            role: "VIEWER",
            activeCompanyId: request.user.companyId,
            companyId: request.user.companyId,
            email: `${portalAccess.id}@portal.local`,
            name: businessClient.name,
            tokenType: "portal",
            portalAccessId: portalAccess.id,
            businessClientId: businessClient.id
          },
          {
            expiresIn: `${payload.expiresInHours}h`
          }
        );

        await prisma.portalAccess.update({
          where: { id: portalAccess.id },
          data: {
            tokenHash: hashToken(token)
          }
        });

        return {
          token,
          businessClient: {
            id: businessClient.id,
            name: businessClient.name
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

    if (request.user.tokenType !== "portal" || !request.user.portalAccessId || !request.user.businessClientId) {
      reply.code(403);
      return { message: "Forbidden" };
    }

    const portalAccess = await prisma.portalAccess.findFirst({
      where: {
        id: request.user.portalAccessId,
        companyId: request.user.companyId,
        businessClientId: request.user.businessClientId,
        active: true
      },
      include: {
        businessClient: {
          include: {
            client: true
          }
        }
      }
    });

    if (!portalAccess || portalAccess.expiresAt.getTime() < Date.now()) {
      reply.code(403);
      return { message: "Portal access expired or revoked" };
    }

    await prisma.portalAccess.update({
      where: { id: portalAccess.id },
      data: {
        lastUsedAt: new Date()
      }
    });

    const linkedClientId = portalAccess.businessClient.clientId;
    const receivables = linkedClientId
      ? await prisma.accountReceivable.findMany({
          where: {
            companyId: request.user.companyId,
            clientId: linkedClientId
          },
          orderBy: { dueDate: "desc" },
          take: 100
        })
      : [];

    return {
      businessClient: {
        id: portalAccess.businessClient.id,
        name: portalAccess.businessClient.name
      },
      client: linkedClientId
        ? {
            id: linkedClientId,
            name: portalAccess.businessClient.client?.name ?? portalAccess.businessClient.name
          }
        : null,
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
