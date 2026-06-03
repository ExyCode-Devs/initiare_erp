import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { approveDraft, patchDraftFields, rejectDraft } from "../lib/draft-workflow.js";
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
        sourceEvent: true,
        sourceEmail: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: query.limit
    });

    return {
      items: items.map((item) => ({
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
        }
      }
    });

    return {
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
      }))
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
          notes: z.string().nullable().optional()
        })
        .parse(request.body);

      const draft = await patchDraftFields({
        draftId: params.id,
        companyId: request.user.companyId,
        user: {
          id: request.user.sub,
          name: request.user.name,
          email: request.user.email
        },
        values: payload
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
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const payload = z.object({ note: z.string().nullable().optional() }).parse(request.body ?? {});
      const draft = await approveDraft({
        draftId: params.id,
        companyId: request.user.companyId,
        user: {
          id: request.user.sub,
          name: request.user.name,
          email: request.user.email
        },
        note: payload.note ?? null
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
