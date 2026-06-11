import { readFile } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { resolveStoredFilePath } from "../lib/storage.js";

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const inboxRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/inbox/emails", async (request) => {
    const query = z
      .object({
        status: z.string().optional(),
        confidenceBand: z.string().optional(),
        limit: z.coerce.number().int().positive().max(100).default(50)
      })
      .parse(request.query);

    const items = await prisma.inboundEmail.findMany({
      where: {
        companyId: request.user.companyId,
        status: query.status as never | undefined,
        financialDrafts:
          query.confidenceBand && query.confidenceBand !== "ALL"
            ? {
                some: {
                  confidenceBand: query.confidenceBand as never
                }
              }
            : undefined
      },
      include: {
        mailbox: true,
        extractionRuns: {
          orderBy: {
            startedAt: "desc"
          },
          take: 1
        },
        financialDrafts: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        },
        attachments: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        receivedAt: "desc"
      },
      take: query.limit
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        mailbox: item.mailbox.name,
        sender: item.sender,
        subject: item.subject,
        receivedAt: item.receivedAt.toISOString(),
        status: item.status,
        attachmentCount: item.attachments.length,
        extractionStatus: item.extractionRuns[0]?.status ?? null,
        draft:
          item.financialDrafts[0] == null
            ? null
            : {
                id: item.financialDrafts[0].id,
                direction: item.financialDrafts[0].direction,
                partyName: item.financialDrafts[0].partyName,
                amount: item.financialDrafts[0].amount ? Number(item.financialDrafts[0].amount) : null,
                confidenceScore: item.financialDrafts[0].confidenceScore,
                confidenceBand: item.financialDrafts[0].confidenceBand,
                status: item.financialDrafts[0].status
              }
      }))
    };
  });

  app.get("/inbox/emails/:id", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);

    const item = await prisma.inboundEmail.findFirstOrThrow({
      where: {
        id: params.id,
        companyId: request.user.companyId
      },
      include: {
        mailbox: true,
        attachments: true,
        extractionRuns: {
          orderBy: {
            startedAt: "desc"
          }
        },
        financialDrafts: {
          include: {
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
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    return {
      id: item.id,
      mailbox: item.mailbox.name,
      sender: item.sender,
      replyTo: item.replyTo,
      toRecipients: stringArray(item.toRecipients),
      ccRecipients: stringArray(item.ccRecipients),
      bccRecipients: stringArray(item.bccRecipients),
      subject: item.subject,
      bodyText: item.bodyText,
      bodyHtml: item.bodyHtml,
      receivedAt: item.receivedAt.toISOString(),
      status: item.status,
      processingError: item.processingError,
      attachments: item.attachments.map((attachment) => ({
        id: attachment.id,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        status: attachment.status,
        processingError: attachment.processingError,
        extractedText: attachment.extractedText,
        downloadPath: `/api/attachments/${attachment.id}/download`
      })),
      extractionRuns: item.extractionRuns.map((run) => ({
        id: run.id,
        provider: run.provider,
        workflowId: run.workflowId,
        status: run.status,
        durationMs: run.durationMs,
        errorMessage: run.errorMessage,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
        parsedResponse: run.parsedResponse
      })),
      drafts: item.financialDrafts.map((draft) => ({
        id: draft.id,
        direction: draft.direction,
        partyName: draft.partyName,
        cpfCnpj: draft.cpfCnpj,
        amount: draft.amount ? Number(draft.amount) : null,
        dueDate: draft.dueDate?.toISOString() ?? null,
        competence: draft.competence,
        description: draft.description,
        suggestedCategory: draft.suggestedCategory,
        finalCategory: draft.finalCategory,
        paymentMethod: draft.paymentMethod,
        bankData: draft.bankData as Record<string, unknown> | null,
        notes: draft.notes,
        confidenceScore: draft.confidenceScore,
        confidenceBand: draft.confidenceBand,
        status: draft.status,
        evidence: draft.evidence,
        rawPayload: draft.rawPayload,
        rejectionReason: draft.rejectionReason,
        reviews: draft.reviews.map((review) => ({
          id: review.id,
          action: review.action,
          note: review.note,
          fieldDelta: review.fieldDelta,
          createdAt: review.createdAt.toISOString(),
          user: review.user
        }))
      }))
    };
  });

  app.get("/attachments/:id/download", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const attachment = await prisma.emailAttachment.findFirstOrThrow({
      where: {
        id: params.id,
        companyId: request.user.companyId
      }
    });

    const buffer = await readFile(resolveStoredFilePath(attachment.storagePath));
    reply.header("content-type", attachment.mimeType);
    reply.header("content-disposition", `attachment; filename="${attachment.originalName}"`);

    return reply.send(buffer);
  });
};

export default inboxRoutes;
