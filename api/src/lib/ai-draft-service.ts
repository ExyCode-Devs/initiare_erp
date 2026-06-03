import { randomUUID } from "node:crypto";
import { Prisma, type AiEventOriginType, type FinancialDirection, type User } from "@prisma/client";
import { writeAuditLog } from "./audit.js";
import { toNullablePrismaJson, toPrismaJson } from "./prisma-json.js";
import { prisma } from "./prisma.js";

type DraftPayload = {
  direction: FinancialDirection;
  partyName: string;
  cpfCnpj?: string | null;
  amount?: number | null;
  dueDate?: string | null;
  competence?: string | null;
  description: string;
  suggestedCategory?: string | null;
  paymentMethod?: string | null;
  bankData?: Record<string, unknown> | null;
  notes?: string | null;
  evidence?: string[] | null;
};

type SourcePayload = {
  channel: string;
  sender?: string | null;
  subject?: string | null;
  summary?: string | null;
  attachments?: Array<Record<string, unknown>>;
};

type AiPayload = {
  provider: string;
  confidenceScore: number;
  rawResponse: string;
  providerMeta?: Record<string, unknown> | null;
  durationMs?: number | null;
};

type IngestInput = {
  companyId: string;
  eventId: string;
  occurredAt: string;
  originType: AiEventOriginType;
  source: SourcePayload;
  draft: DraftPayload;
  ai: AiPayload;
  rawPayload: Record<string, unknown>;
};

type InternalInvokeResult = {
  draft: DraftPayload;
  ai: AiPayload;
  rawPayload?: Record<string, unknown>;
};

type InternalFailureContext = {
  actionLabel: string;
  entityLabel: string;
  entityId: string;
};

type InternalGenerationInput = {
  companyId: string;
  eventId: string;
  occurredAt?: string;
  source: SourcePayload;
  requestPayload: Record<string, unknown>;
  invokeAi: () => Promise<InternalInvokeResult>;
  failureContext: InternalFailureContext;
  user?: Pick<User, "id" | "name" | "email"> | null;
};

function clampConfidenceScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function confidenceBandFromScore(value: number) {
  const bounded = clampConfidenceScore(value);
  return bounded >= 80 ? "ALTA" : bounded >= 55 ? "MEDIA" : "BAIXA";
}

function buildSourceLabel(originType: AiEventOriginType) {
  return originType === "ACTIVE_ACTIONS" ? "Active Actions" : "Internal AI";
}

async function createFailureException(input: {
  companyId: string;
  failureContext: InternalFailureContext;
  source: SourcePayload;
  errorMessage: string;
}) {
  const code = `AI-${randomUUID().slice(0, 8).toUpperCase()}`;

  await prisma.exceptionItem.create({
    data: {
      companyId: input.companyId,
      code,
      title: `AI failure on ${input.failureContext.actionLabel} for ${input.failureContext.entityLabel}`,
      description: input.errorMessage,
      suggestion: "Review payload, retry AI generation, or complete draft manually.",
      confidence: 0,
      severity: "ALTA",
      timeLabel: "agora",
      timeline: toPrismaJson([
        {
          t: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          text: `Internal AI call failed for ${input.failureContext.entityLabel} ${input.failureContext.entityId}.`
        },
        {
          t: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          text: input.source.subject ?? input.source.summary ?? "No source summary available."
        }
      ])
    }
  });
}

async function persistDraftFromEvent(tx: Prisma.TransactionClient, input: IngestInput & { aiRunId: string; eventSourceId: string }) {
  const confidenceScore = clampConfidenceScore(input.ai.confidenceScore);
  const confidenceBand = confidenceBandFromScore(confidenceScore);

  return tx.financialDraft.create({
    data: {
      companyId: input.companyId,
      direction: input.draft.direction,
      partyName: input.draft.partyName,
      cpfCnpj: input.draft.cpfCnpj ?? null,
      amount: input.draft.amount ?? null,
      dueDate: input.draft.dueDate ? new Date(input.draft.dueDate) : null,
      competence: input.draft.competence ?? null,
      description: input.draft.description,
      suggestedCategory: input.draft.suggestedCategory ?? null,
      finalCategory: input.draft.suggestedCategory ?? null,
      paymentMethod: input.draft.paymentMethod ?? null,
      bankData: toNullablePrismaJson(input.draft.bankData ?? null),
      notes: input.draft.notes ?? null,
      evidence: toPrismaJson(input.draft.evidence ?? []),
      rawPayload: toPrismaJson(input.rawPayload),
      confidenceScore,
      confidenceBand,
      sourceLabel: buildSourceLabel(input.originType),
      sourceEventId: input.eventSourceId,
      aiRunId: input.aiRunId
    }
  });
}

export async function resolveDefaultCompanyId() {
  const company = await prisma.company.findFirstOrThrow({
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  return company.id;
}

export async function ingestExternalNormalizedDraft(input: IngestInput) {
  const duplicate = await prisma.aiEventSource.findUnique({
    where: {
      companyId_eventId: {
        companyId: input.companyId,
        eventId: input.eventId
      }
    },
    include: {
      aiRuns: {
        orderBy: { startedAt: "desc" },
        take: 1
      },
      financialDrafts: {
        orderBy: { createdAt: "desc" },
        take: 1
      }
    }
  });

  if (duplicate) {
    return {
      mode: "duplicate" as const,
      eventSourceId: duplicate.id,
      aiRunId: duplicate.aiRuns[0]?.id ?? null,
      draftId: duplicate.financialDrafts[0]?.id ?? null
    };
  }

  const created = await prisma.$transaction(async (tx) => {
    const eventSource = await tx.aiEventSource.create({
      data: {
        companyId: input.companyId,
        eventId: input.eventId,
        originType: input.originType,
        channel: input.source.channel,
        sender: input.source.sender ?? null,
        subject: input.source.subject ?? null,
        summary: input.source.summary ?? null,
        attachmentsMeta: toNullablePrismaJson(input.source.attachments ?? []),
        rawPayload: toPrismaJson(input.rawPayload),
        receivedAt: new Date(input.occurredAt)
      }
    });

    const aiRun = await tx.aiGatewayRun.create({
      data: {
        companyId: input.companyId,
        eventSourceId: eventSource.id,
        provider: input.ai.provider,
        requestPayload: toPrismaJson({
          eventId: input.eventId,
          source: input.source,
          draft: input.draft
        }),
        rawResponse: input.ai.rawResponse,
        parsedResponse: toPrismaJson({
          draft: input.draft,
          providerMeta: input.ai.providerMeta ?? null
        }),
        status: "SUCESSO",
        durationMs: input.ai.durationMs ?? null,
        completedAt: new Date()
      }
    });

    const draft = await persistDraftFromEvent(tx, {
      ...input,
      aiRunId: aiRun.id,
      eventSourceId: eventSource.id
    });

    await tx.aiEventSource.update({
      where: { id: eventSource.id },
      data: { status: "PROCESSED" }
    });

    return {
      eventSourceId: eventSource.id,
      aiRunId: aiRun.id,
      draftId: draft.id
    };
  });

  await writeAuditLog({
    companyId: input.companyId,
    action: "ai_event.processed",
    resource: "ai-event-source",
    details: {
      eventId: input.eventId,
      eventSourceId: created.eventSourceId,
      aiRunId: created.aiRunId,
      draftId: created.draftId,
      originType: input.originType
    }
  });

  return {
    mode: "created" as const,
    ...created
  };
}

export async function runInternalDraftGeneration(input: InternalGenerationInput) {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const eventSource = await prisma.aiEventSource.create({
    data: {
      companyId: input.companyId,
      eventId: input.eventId,
      originType: "INTERNAL",
      channel: input.source.channel,
      sender: input.source.sender ?? null,
      subject: input.source.subject ?? null,
      summary: input.source.summary ?? null,
      attachmentsMeta: toNullablePrismaJson(input.source.attachments ?? []),
      rawPayload: toPrismaJson(input.requestPayload),
      receivedAt: new Date(occurredAt)
    }
  });

  const aiRun = await prisma.aiGatewayRun.create({
    data: {
      companyId: input.companyId,
      eventSourceId: eventSource.id,
      provider: "internal-ai",
      requestPayload: toPrismaJson(input.requestPayload)
    }
  });

  try {
    const result = await input.invokeAi();

    const persisted = await prisma.$transaction(async (tx) => {
      const updatedRun = await tx.aiGatewayRun.update({
        where: { id: aiRun.id },
        data: {
          provider: result.ai.provider,
          rawResponse: result.ai.rawResponse,
          parsedResponse: toPrismaJson({
            draft: result.draft,
            providerMeta: result.ai.providerMeta ?? null
          }),
          status: "SUCESSO",
          durationMs: result.ai.durationMs ?? null,
          completedAt: new Date()
        }
      });

      const draft = await persistDraftFromEvent(tx, {
        companyId: input.companyId,
        eventId: input.eventId,
        occurredAt,
        originType: "INTERNAL",
        source: input.source,
        draft: result.draft,
        ai: result.ai,
        rawPayload: result.rawPayload ?? input.requestPayload,
        aiRunId: updatedRun.id,
        eventSourceId: eventSource.id
      });

      await tx.aiEventSource.update({
        where: { id: eventSource.id },
        data: { status: "PROCESSED" }
      });

      return {
        aiRunId: updatedRun.id,
        draftId: draft.id
      };
    });

    await writeAuditLog({
      companyId: input.companyId,
      userId: input.user?.id ?? null,
      action: "internal_ai.processed",
      resource: "ai-event-source",
      details: {
        eventId: input.eventId,
        eventSourceId: eventSource.id,
        aiRunId: persisted.aiRunId,
        draftId: persisted.draftId
      }
    });

    return {
      mode: "created" as const,
      eventSourceId: eventSource.id,
      aiRunId: persisted.aiRunId,
      draftId: persisted.draftId
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal AI generation failed";

    await prisma.$transaction(async (tx) => {
      await tx.aiGatewayRun.update({
        where: { id: aiRun.id },
        data: {
          status: "ERRO",
          errorMessage: message,
          completedAt: new Date()
        }
      });

      await tx.aiEventSource.update({
        where: { id: eventSource.id },
        data: {
          status: "FAILED",
          processingError: message
        }
      });
    });

    await createFailureException({
      companyId: input.companyId,
      failureContext: input.failureContext,
      source: input.source,
      errorMessage: message
    });

    await writeAuditLog({
      companyId: input.companyId,
      userId: input.user?.id ?? null,
      action: "internal_ai.failed",
      resource: "ai-event-source",
      details: {
        eventId: input.eventId,
        eventSourceId: eventSource.id,
        aiRunId: aiRun.id,
        error: message
      }
    });

    return {
      mode: "failed" as const,
      eventSourceId: eventSource.id,
      aiRunId: aiRun.id,
      draftId: null,
      error: message
    };
  }
}
