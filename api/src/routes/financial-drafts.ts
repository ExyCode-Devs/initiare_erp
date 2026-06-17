import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  DraftRouteSource,
  DraftRoutingStatus,
  ErpEnvironment,
  ErpProvider,
  ErpSyncEntityType
} from "@prisma/client";
import {
  approveDraft,
  getDraftApprovalBlockers,
  getDraftExecutionSummary,
  getDraftWorkflowStatus,
  listDraftDuplicateCandidates,
  markDraftAsDuplicate,
  patchDraftFields,
  rejectDraft,
  requestDraftReprocess,
  undoDraftDuplicate
} from "../lib/draft-workflow.js";
import { getLegalEntityOrThrow } from "../lib/legal-entities.js";
import { exportDraftToOmie, retryDraftExecution, runApprovedDraftExecution } from "../lib/omie-export-service.js";
import { prisma } from "../lib/prisma.js";

function mapLegacySource(item: {
  sourceEmail: {
    id: string;
    sender: string;
    subject: string;
    bodyText: string;
    receivedAt: Date;
  } | null;
}) {
  if (!item.sourceEmail) {
    return null;
  }

  return {
    id: item.sourceEmail.id,
    originType: "LEGACY_EMAIL",
    channel: "legacy-email",
    sender: item.sourceEmail.sender,
    subject: item.sourceEmail.subject,
    summary: item.sourceEmail.bodyText,
    receivedAt: item.sourceEmail.receivedAt.toISOString(),
    attachments: [],
    rawPayload: null,
    status: "PROCESSED",
    processingError: null
  };
}

function buildReviewSnapshot(item: Parameters<typeof getDraftApprovalBlockers>[0]) {
  const blockers = getDraftApprovalBlockers(item);

  return {
    workflowStatus: getDraftWorkflowStatus(item),
    execution: getDraftExecutionSummary(item),
    blockers,
    canApprove: blockers.length === 0
  };
}

const financialDraftRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/financial-drafts", async (request) => {
    const query = z
      .object({
        status: z.string().optional(),
        confidenceBand: z.string().optional(),
        direction: z.string().optional(),
        limit: z.coerce.number().int().positive().max(100).default(50)
      })
      .parse(request.query);

    const items = await prisma.financialDraft.findMany({
      where: {
        companyId: request.user.companyId,
        status: query.status as never | undefined,
        confidenceBand: query.confidenceBand as never | undefined,
        direction: query.direction as never | undefined
      },
      include: {
        legalEntity: true,
        sourceEvent: true,
        sourceEmail: true,
        erpSyncRecords: {
          where: {
            provider: ErpProvider.OMIE,
            entityType: {
              in: [ErpSyncEntityType.ACCOUNT_PAYABLE, ErpSyncEntityType.ACCOUNT_RECEIVABLE]
            }
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 1
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: query.limit
    });

    return {
      items: items.map((item) => ({
        review: buildReviewSnapshot(item),
        id: item.id,
        direction: item.direction,
        partyName: item.partyName,
        cpfCnpj: item.cpfCnpj,
        amount: item.amount ? Number(item.amount) : null,
        dueDate: item.dueDate?.toISOString() ?? null,
        description: item.description,
        suggestedCategory: item.suggestedCategory,
        finalCategory: item.finalCategory,
        paymentMethod: item.paymentMethod,
        legalEntityId: item.legalEntityId,
        legalEntityName: item.legalEntity?.tradeName ?? item.legalEntity?.legalName ?? null,
        routingStatus: item.routingStatus,
        routingReason: item.routingReason,
        routeSource: item.routeSource,
        confidenceScore: item.confidenceScore,
        confidenceBand: item.confidenceBand,
        status: item.status,
        source:
          item.sourceEvent == null
            ? mapLegacySource(item)
            : {
                id: item.sourceEvent.id,
                originType: item.sourceEvent.originType,
                channel: item.sourceEvent.channel,
                sender: item.sourceEvent.sender,
                subject: item.sourceEvent.subject,
                summary: item.sourceEvent.summary,
                receivedAt: item.sourceEvent.receivedAt.toISOString()
              },
        email:
          item.sourceEmail == null
            ? null
            : {
                id: item.sourceEmail.id,
                sender: item.sourceEmail.sender,
                subject: item.sourceEmail.subject
              },
        omieSync:
          item.erpSyncRecords[0] == null
            ? null
            : {
                environment: item.erpSyncRecords[0].environment,
                status: item.erpSyncRecords[0].status,
                externalId: item.erpSyncRecords[0].externalId,
                errorMessage: item.erpSyncRecords[0].errorMessage
              }
      }))
    };
  });

  app.get("/financial-drafts/:id", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const item = await prisma.financialDraft.findFirstOrThrow({
      where: {
        id: params.id,
        companyId: request.user.companyId
      },
      include: {
        legalEntity: true,
        sourceEvent: true,
        aiRun: true,
        sourceEmail: {
          include: {
            attachments: true,
            extractionRuns: true
          }
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        erpSyncRecords: {
          where: {
            provider: ErpProvider.OMIE
          },
          orderBy: {
            updatedAt: "desc"
          }
        },
        erpRequestLogs: {
          where: {
            connection: {
              provider: ErpProvider.OMIE
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 15
        }
      }
    });

    return {
      review: {
        ...buildReviewSnapshot(item),
        duplicateCandidates: await listDraftDuplicateCandidates({
          draftId: item.id,
          companyId: request.user.companyId
        })
      },
      id: item.id,
      direction: item.direction,
      partyName: item.partyName,
      cpfCnpj: item.cpfCnpj,
      amount: item.amount ? Number(item.amount) : null,
      dueDate: item.dueDate?.toISOString() ?? null,
      competence: item.competence,
      description: item.description,
      suggestedCategory: item.suggestedCategory,
      finalCategory: item.finalCategory,
      paymentMethod: item.paymentMethod,
      legalEntityId: item.legalEntityId,
      legalEntityName: item.legalEntity?.tradeName ?? item.legalEntity?.legalName ?? null,
      routingStatus: item.routingStatus,
      routingReason: item.routingReason,
      routeSource: item.routeSource,
      bankData: item.bankData,
      notes: item.notes,
      confidenceScore: item.confidenceScore,
      confidenceBand: item.confidenceBand,
      status: item.status,
      evidence: item.evidence,
      rawPayload: item.rawPayload,
      rejectionReason: item.rejectionReason,
      source:
        item.sourceEvent == null
          ? mapLegacySource(item)
          : {
              id: item.sourceEvent.id,
              originType: item.sourceEvent.originType,
              channel: item.sourceEvent.channel,
              sender: item.sourceEvent.sender,
              subject: item.sourceEvent.subject,
              summary: item.sourceEvent.summary,
              receivedAt: item.sourceEvent.receivedAt.toISOString(),
              attachments: item.sourceEvent.attachmentsMeta,
              rawPayload: item.sourceEvent.rawPayload,
              status: item.sourceEvent.status,
              processingError: item.sourceEvent.processingError
            },
      aiRun:
        item.aiRun == null
          ? null
          : {
              id: item.aiRun.id,
              provider: item.aiRun.provider,
              status: item.aiRun.status,
              errorMessage: item.aiRun.errorMessage,
              rawResponse: item.aiRun.rawResponse,
              parsedResponse: item.aiRun.parsedResponse,
              startedAt: item.aiRun.startedAt.toISOString(),
              completedAt: item.aiRun.completedAt?.toISOString() ?? null
            },
      sourceEmail:
        item.sourceEmail == null
          ? null
          : {
              id: item.sourceEmail.id,
              sender: item.sourceEmail.sender,
              subject: item.sourceEmail.subject,
              bodyText: item.sourceEmail.bodyText,
              receivedAt: item.sourceEmail.receivedAt.toISOString(),
              attachments: item.sourceEmail.attachments.map((attachment) => ({
                id: attachment.id,
                originalName: attachment.originalName,
                mimeType: attachment.mimeType,
                extractedText: attachment.extractedText
              })),
              extractionRuns: item.sourceEmail.extractionRuns.map((run) => ({
                id: run.id,
                provider: run.provider,
                workflowId: run.workflowId,
                status: run.status,
                errorMessage: run.errorMessage,
                parsedResponse: run.parsedResponse,
                startedAt: run.startedAt.toISOString(),
                completedAt: run.completedAt?.toISOString() ?? null
              }))
            },
      reviews: item.reviews.map((review) => ({
        id: review.id,
        action: review.action,
        note: review.note,
        fieldDelta: review.fieldDelta,
        createdAt: review.createdAt.toISOString(),
        user: review.user
      })),
      omieHistory: {
        syncs: item.erpSyncRecords.map((record) => ({
          id: record.id,
          entityType: record.entityType,
          environment: record.environment,
          status: record.status,
          externalId: record.externalId,
          errorMessage: record.errorMessage,
          syncedAt: record.syncedAt?.toISOString() ?? null,
          createdAt: record.createdAt.toISOString()
        })),
        requests: item.erpRequestLogs.map((entry) => ({
          id: entry.id,
          endpoint: entry.endpoint,
          method: entry.method,
          httpStatus: entry.httpStatus,
          operationStatus: entry.operationStatus,
          friendlyError: entry.friendlyError,
          technicalError: entry.technicalError,
          createdAt: entry.createdAt.toISOString()
        }))
      }
    };
  });

  app.patch(
    "/financial-drafts/:id",
    {
      preHandler: app.authorize(["ADMIN", "ANALYST"])
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = z
        .object({
          partyName: z.string().min(2).optional(),
          cpfCnpj: z.string().nullable().optional(),
          amount: z.coerce.number().positive().nullable().optional(),
          dueDate: z.string().nullable().optional(),
          competence: z.string().nullable().optional(),
          description: z.string().min(2).optional(),
          suggestedCategory: z.string().nullable().optional(),
          finalCategory: z.string().nullable().optional(),
          paymentMethod: z.string().nullable().optional(),
          bankData: z.record(z.string(), z.unknown()).nullable().optional(),
          notes: z.string().nullable().optional(),
          legalEntityId: z.string().nullable().optional()
        })
        .parse(request.body);

      if (payload.legalEntityId) {
        await getLegalEntityOrThrow(request.user.companyId, payload.legalEntityId);
      }

      const draft = await patchDraftFields({
        draftId: params.id,
        companyId: request.user.companyId,
        user: {
          id: request.user.sub,
          name: request.user.name,
          email: request.user.email
        },
        values: {
          ...payload,
          routingStatus: payload.legalEntityId ? DraftRoutingStatus.ROUTED : undefined,
          routeSource: payload.legalEntityId ? DraftRouteSource.MANUAL : undefined,
          routingReason: payload.legalEntityId ? "Entidade legal atribuída manualmente pelo analista." : undefined
        }
      });

      return {
        id: draft.id,
        status: draft.status
      };
    }
  );

  app.post(
    "/financial-drafts/:id/approve",
    {
      preHandler: app.authorize(["ADMIN", "ANALYST"])
    },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = z.object({ note: z.string().nullable().optional() }).parse(request.body ?? {});
      const draft = await prisma.financialDraft.findFirstOrThrow({
        where: {
          id: params.id,
          companyId: request.user.companyId
        }
      });
      const blockers = getDraftApprovalBlockers(draft);
      if (blockers.length > 0) {
        reply.code(409);
        return {
          message: "Approval blocked by review rules.",
          blockers
        };
      }
      const approvedDraft = await approveDraft({
        draftId: params.id,
        companyId: request.user.companyId,
        user: {
          id: request.user.sub,
          name: request.user.name,
          email: request.user.email
        },
        note: payload.note ?? null,
        environment: ErpEnvironment.HOMOLOG
      });
      const execution = await runApprovedDraftExecution({
        companyId: request.user.companyId,
        draftId: params.id,
        environment: ErpEnvironment.HOMOLOG,
        triggeredByUserId: request.user.sub
      });

      return {
        id: approvedDraft.id,
        status: approvedDraft.status,
        execution
      };
    }
  );

  app.post(
    "/financial-drafts/:id/retry-execution",
    {
      preHandler: app.authorize(["ADMIN", "ANALYST"])
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = z
        .object({
          environment: z.nativeEnum(ErpEnvironment).default(ErpEnvironment.HOMOLOG)
        })
        .parse(request.body ?? {});

      return retryDraftExecution({
        companyId: request.user.companyId,
        draftId: params.id,
        environment: payload.environment,
        triggeredByUserId: request.user.sub
      });
    }
  );

  app.post(
    "/financial-drafts/:id/omie-export",
    {
      preHandler: app.authorize(["ADMIN", "ANALYST"])
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = z
        .object({
          environment: z.nativeEnum(ErpEnvironment).default(ErpEnvironment.HOMOLOG)
        })
        .parse(request.body ?? {});

      return exportDraftToOmie({
        companyId: request.user.companyId,
        draftId: params.id,
        environment: payload.environment,
        triggeredByUserId: request.user.sub
      });
    }
  );

  app.get("/financial-drafts/:id/omie-history", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const draft = await prisma.financialDraft.findFirstOrThrow({
      where: {
        id: params.id,
        companyId: request.user.companyId
      },
      include: {
        erpSyncRecords: {
          where: {
            provider: ErpProvider.OMIE
          },
          orderBy: {
            createdAt: "desc"
          }
        },
        erpRequestLogs: {
          where: {
            connection: {
              provider: ErpProvider.OMIE
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    return {
      draftId: draft.id,
      syncs: draft.erpSyncRecords.map((record) => ({
        id: record.id,
        entityType: record.entityType,
        environment: record.environment,
        status: record.status,
        externalId: record.externalId,
        errorMessage: record.errorMessage,
        syncedAt: record.syncedAt?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString()
      })),
      requests: draft.erpRequestLogs.map((entry) => ({
        id: entry.id,
        endpoint: entry.endpoint,
        method: entry.method,
        httpStatus: entry.httpStatus,
        operationStatus: entry.operationStatus,
        friendlyError: entry.friendlyError,
        technicalError: entry.technicalError,
        createdAt: entry.createdAt.toISOString()
      }))
    };
  });

  app.post(
    "/financial-drafts/:id/mark-duplicate",
    {
      preHandler: app.authorize(["ADMIN", "ANALYST"])
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = z
        .object({
          duplicateOfId: z.string().min(1),
          note: z.string().nullable().optional()
        })
        .parse(request.body);

      const draft = await markDraftAsDuplicate({
        draftId: params.id,
        companyId: request.user.companyId,
        duplicateOfId: payload.duplicateOfId,
        note: payload.note ?? null,
        user: {
          id: request.user.sub,
          name: request.user.name,
          email: request.user.email
        }
      });

      return {
        id: draft.id,
        status: draft.status
      };
    }
  );

  app.post(
    "/financial-drafts/:id/undo-duplicate",
    {
      preHandler: app.authorize(["ADMIN", "ANALYST"])
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const draft = await undoDraftDuplicate({
        draftId: params.id,
        companyId: request.user.companyId,
        user: {
          id: request.user.sub,
          name: request.user.name,
          email: request.user.email
        }
      });

      return {
        id: draft.id,
        status: draft.status
      };
    }
  );

  app.post(
    "/financial-drafts/:id/request-reprocess",
    {
      preHandler: app.authorize(["ADMIN", "ANALYST"])
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = z.object({ note: z.string().nullable().optional() }).parse(request.body ?? {});
      const draft = await requestDraftReprocess({
        draftId: params.id,
        companyId: request.user.companyId,
        note: payload.note ?? null,
        user: {
          id: request.user.sub,
          name: request.user.name,
          email: request.user.email
        }
      });

      return {
        id: draft.id,
        status: draft.status
      };
    }
  );

  app.post(
    "/financial-drafts/:id/reject",
    {
      preHandler: app.authorize(["ADMIN", "ANALYST"])
    },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = z.object({ reason: z.string().min(3) }).parse(request.body);
      const draft = await rejectDraft({
        draftId: params.id,
        companyId: request.user.companyId,
        user: {
          id: request.user.sub,
          name: request.user.name,
          email: request.user.email
        },
        reason: payload.reason
      });

      return {
        id: draft.id,
        status: draft.status
      };
    }
  );
};

export default financialDraftRoutes;
