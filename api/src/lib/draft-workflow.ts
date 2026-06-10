import { DraftRouteSource, DraftRoutingStatus, DraftStatus, Prisma, ReviewAction, type User } from "@prisma/client";
import { prisma } from "./prisma.js";
import { writeAuditLog } from "./audit.js";
import { toNullablePrismaJson, toPrismaJson } from "./prisma-json.js";

type WorkflowState =
  | "draft_ai"
  | "draft_integration"
  | "pending_review"
  | "edited"
  | "approved"
  | "rejected"
  | "duplicated"
  | "sent_to_integration"
  | "integration_error"
  | "completed"
  | "answered";

export type DraftExecutionStatus = "idle" | "queued" | "running" | "success" | "error";

type WorkflowBlockerCode =
  | "missing_party_name"
  | "missing_amount"
  | "missing_due_date"
  | "missing_description"
  | "missing_category"
  | "missing_evidence"
  | "route_unresolved"
  | "route_ambiguity"
  | "duplicate_marked";

type WorkflowBlocker = {
  code: WorkflowBlockerCode;
  message: string;
};

type WorkflowMetadata = {
  reviewState?: WorkflowState;
  duplicateOfId?: string | null;
  duplicateReason?: string | null;
  duplicateMarkedAt?: string | null;
  duplicateMarkedByUserId?: string | null;
  reprocessRequestedAt?: string | null;
  reprocessRequestedByUserId?: string | null;
  reprocessNote?: string | null;
  lastEditedAt?: string | null;
  execution?: {
    provider?: string | null;
    environment?: string | null;
    status?: DraftExecutionStatus;
    queuedAt?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    retryCount?: number;
    lastError?: string | null;
    externalPartyId?: string | null;
    externalEntryId?: string | null;
    requestPayload?: unknown;
    responsePayload?: unknown;
    billingArtifact?: unknown;
  } | null;
};

type DraftForReview = {
  id: string;
  companyId: string;
  status: DraftStatus;
  direction: "CONTA_PAGAR" | "CONTA_RECEBER";
  partyName: string;
  amount: Prisma.Decimal | number | null;
  dueDate: Date | null;
  description: string;
  finalCategory: string | null;
  suggestedCategory: string | null;
  legalEntityId: string | null;
  routingStatus: DraftRoutingStatus;
  routingReason: string | null;
  evidence: unknown;
  rawPayload: unknown;
  cpfCnpj?: string | null;
  confidenceScore?: number;
  reviews?: Array<{ action: ReviewAction }>;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function getWorkflowMetadata(rawPayload: unknown): WorkflowMetadata {
  const base = asObject(rawPayload);
  const workflow = asObject(base._workflow);
  const execution = asObject(workflow.execution);

  return {
    reviewState: typeof workflow.reviewState === "string" ? (workflow.reviewState as WorkflowState) : undefined,
    duplicateOfId: typeof workflow.duplicateOfId === "string" ? workflow.duplicateOfId : null,
    duplicateReason: typeof workflow.duplicateReason === "string" ? workflow.duplicateReason : null,
    duplicateMarkedAt: typeof workflow.duplicateMarkedAt === "string" ? workflow.duplicateMarkedAt : null,
    duplicateMarkedByUserId:
      typeof workflow.duplicateMarkedByUserId === "string" ? workflow.duplicateMarkedByUserId : null,
    reprocessRequestedAt:
      typeof workflow.reprocessRequestedAt === "string" ? workflow.reprocessRequestedAt : null,
    reprocessRequestedByUserId:
      typeof workflow.reprocessRequestedByUserId === "string" ? workflow.reprocessRequestedByUserId : null,
    reprocessNote: typeof workflow.reprocessNote === "string" ? workflow.reprocessNote : null,
    lastEditedAt: typeof workflow.lastEditedAt === "string" ? workflow.lastEditedAt : null,
    execution:
      Object.keys(execution).length === 0
        ? null
        : {
            provider: typeof execution.provider === "string" ? execution.provider : null,
            environment: typeof execution.environment === "string" ? execution.environment : null,
            status: typeof execution.status === "string" ? (execution.status as DraftExecutionStatus) : "idle",
            queuedAt: typeof execution.queuedAt === "string" ? execution.queuedAt : null,
            startedAt: typeof execution.startedAt === "string" ? execution.startedAt : null,
            finishedAt: typeof execution.finishedAt === "string" ? execution.finishedAt : null,
            retryCount: typeof execution.retryCount === "number" ? execution.retryCount : 0,
            lastError: typeof execution.lastError === "string" ? execution.lastError : null,
            externalPartyId: typeof execution.externalPartyId === "string" ? execution.externalPartyId : null,
            externalEntryId: typeof execution.externalEntryId === "string" ? execution.externalEntryId : null,
            requestPayload: execution.requestPayload ?? null,
            responsePayload: execution.responsePayload ?? null,
            billingArtifact: execution.billingArtifact ?? null
          }
  };
}

function mergeWorkflowMetadata(rawPayload: unknown, patch: Partial<WorkflowMetadata>) {
  const base = asObject(rawPayload);
  const current = getWorkflowMetadata(rawPayload);
  const next = {
    ...current,
    ...patch
  };

  return toPrismaJson({
    ...base,
    _workflow: next
  });
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function evidenceList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

export function getDraftWorkflowStatus(draft: DraftForReview): WorkflowState {
  const metadata = getWorkflowMetadata(draft.rawPayload);
  const execution = metadata.execution;

  if (execution?.status === "success") {
    return "completed";
  }

  if (execution?.status === "error") {
    return "integration_error";
  }

  if (execution?.status === "running") {
    return "sent_to_integration";
  }

  if (metadata.reviewState) {
    return metadata.reviewState;
  }

  if (draft.status === DraftStatus.APROVADO) {
    return "approved";
  }

  if (draft.status === DraftStatus.REJEITADO) {
    return "rejected";
  }

  if (draft.reviews?.some((review) => review.action === ReviewAction.EDIT)) {
    return "edited";
  }

  return "pending_review";
}

export function getDraftExecutionSummary(draft: DraftForReview) {
  const execution = getWorkflowMetadata(draft.rawPayload).execution;

  if (!execution) {
    return null;
  }

  return {
    provider: execution.provider ?? "OMIE",
    environment: execution.environment ?? "HOMOLOG",
    status: execution.status ?? "idle",
    queuedAt: execution.queuedAt ?? null,
    startedAt: execution.startedAt ?? null,
    finishedAt: execution.finishedAt ?? null,
    retryCount: execution.retryCount ?? 0,
    lastError: execution.lastError ?? null,
    externalPartyId: execution.externalPartyId ?? null,
    externalEntryId: execution.externalEntryId ?? null,
    requestPayload: execution.requestPayload ?? null,
    responsePayload: execution.responsePayload ?? null,
    billingArtifact: execution.billingArtifact ?? null
  };
}

export function getDraftApprovalBlockers(draft: DraftForReview): WorkflowBlocker[] {
  const blockers: WorkflowBlocker[] = [];
  const workflow = getWorkflowMetadata(draft.rawPayload);
  const evidence = evidenceList(draft.evidence);

  if (!draft.partyName.trim()) {
    blockers.push({ code: "missing_party_name", message: "Party name is required before approval." });
  }

  if (draft.amount == null || Number(draft.amount) <= 0) {
    blockers.push({ code: "missing_amount", message: "Amount is required before approval." });
  }

  if (!draft.dueDate) {
    blockers.push({ code: "missing_due_date", message: "Due date is required before approval." });
  }

  if (!draft.description.trim()) {
    blockers.push({ code: "missing_description", message: "Description is required before approval." });
  }

  if (draft.direction === "CONTA_PAGAR" && !draft.finalCategory && !draft.suggestedCategory) {
    blockers.push({ code: "missing_category", message: "Category or classification placeholder is required for payable approval." });
  }

  if (evidence.length === 0) {
    blockers.push({ code: "missing_evidence", message: "Source evidence is required before approval." });
  }

  if (draft.routingStatus !== DraftRoutingStatus.ROUTED || !draft.legalEntityId) {
    blockers.push({ code: "route_unresolved", message: "Routing must be resolved before approval." });
  }

  if (normalizeText(draft.routingReason).includes("ambiguous")) {
    blockers.push({ code: "route_ambiguity", message: "Ambiguous route must be manually resolved before approval." });
  }

  if (workflow.reviewState === "duplicated" || workflow.duplicateOfId) {
    blockers.push({ code: "duplicate_marked", message: "Duplicate entries cannot be approved until duplicate mark is undone." });
  }

  return blockers;
}

export async function listDraftDuplicateCandidates(input: {
  draftId: string;
  companyId: string;
}) {
  const draft = await prisma.financialDraft.findFirstOrThrow({
    where: {
      id: input.draftId,
      companyId: input.companyId
    }
  });

  const candidates = await prisma.financialDraft.findMany({
    where: {
      companyId: input.companyId,
      id: {
        not: draft.id
      },
      direction: draft.direction
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 25
  });

  return candidates
    .map((candidate) => {
      let score = 0;

      if (normalizeText(candidate.partyName) === normalizeText(draft.partyName)) {
        score += 3;
      }

      if (candidate.cpfCnpj && draft.cpfCnpj && candidate.cpfCnpj === draft.cpfCnpj) {
        score += 3;
      }

      if (candidate.amount != null && draft.amount != null && Number(candidate.amount) === Number(draft.amount)) {
        score += 2;
      }

      if (
        candidate.dueDate &&
        draft.dueDate &&
        candidate.dueDate.toISOString().slice(0, 10) === draft.dueDate.toISOString().slice(0, 10)
      ) {
        score += 2;
      }

      if (normalizeText(candidate.description) === normalizeText(draft.description)) {
        score += 1;
      }

      return {
        id: candidate.id,
        partyName: candidate.partyName,
        amount: candidate.amount ? Number(candidate.amount) : null,
        dueDate: candidate.dueDate?.toISOString() ?? null,
        status: candidate.status,
        score
      };
    })
    .filter((candidate) => candidate.score >= 4)
    .sort((left, right) => right.score - left.score);
}

function buildDelta(before: Record<string, unknown>, after: Record<string, unknown>) {
  const delta: Record<string, { before: unknown; after: unknown }> = {};

  for (const [key, beforeValue] of Object.entries(before)) {
    const afterValue = after[key];
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      delta[key] = {
        before: beforeValue,
        after: afterValue
      };
    }
  }

  return delta;
}

async function createDraftReview(input: {
  companyId: string;
  draftId: string;
  userId: string;
  action: ReviewAction;
  note?: string | null;
  fieldDelta?: Record<string, unknown> | null;
}) {
  return prisma.financialDraftReview.create({
    data: {
      companyId: input.companyId,
      draftId: input.draftId,
      userId: input.userId,
      action: input.action,
      note: input.note ?? null,
      fieldDelta: toNullablePrismaJson(input.fieldDelta ?? null)
    }
  });
}

export async function patchDraftFields(input: {
  draftId: string;
  companyId: string;
  user: Pick<User, "id" | "name" | "email">;
  values: Partial<{
    partyName: string;
    cpfCnpj: string | null;
    amount: number | null;
    dueDate: string | null;
    competence: string | null;
    description: string;
    suggestedCategory: string | null;
    finalCategory: string | null;
    paymentMethod: string | null;
    bankData: Record<string, unknown> | null;
    notes: string | null;
    legalEntityId: string | null;
    routingStatus: DraftRoutingStatus;
    routeSource: DraftRouteSource;
    routingReason: string | null;
  }>;
}) {
  const draft = await prisma.financialDraft.findFirstOrThrow({
    where: {
      id: input.draftId,
      companyId: input.companyId
    }
  });

  const updated = await prisma.financialDraft.update({
    where: { id: draft.id },
    data: {
      partyName: input.values.partyName ?? draft.partyName,
      cpfCnpj: input.values.cpfCnpj === undefined ? draft.cpfCnpj : input.values.cpfCnpj,
      amount: input.values.amount === undefined ? draft.amount : input.values.amount,
      dueDate:
        input.values.dueDate === undefined
          ? draft.dueDate
          : input.values.dueDate
            ? new Date(input.values.dueDate)
            : null,
      competence: input.values.competence === undefined ? draft.competence : input.values.competence,
      description: input.values.description ?? draft.description,
      suggestedCategory:
        input.values.suggestedCategory === undefined ? draft.suggestedCategory : input.values.suggestedCategory,
      finalCategory: input.values.finalCategory === undefined ? draft.finalCategory : input.values.finalCategory,
      paymentMethod: input.values.paymentMethod === undefined ? draft.paymentMethod : input.values.paymentMethod,
      notes: input.values.notes === undefined ? draft.notes : input.values.notes,
      legalEntityId: input.values.legalEntityId === undefined ? draft.legalEntityId : input.values.legalEntityId,
      routingStatus: input.values.routingStatus === undefined ? draft.routingStatus : input.values.routingStatus,
      routeSource: input.values.routeSource === undefined ? draft.routeSource : input.values.routeSource,
      routingReason: input.values.routingReason === undefined ? draft.routingReason : input.values.routingReason,
      reviewedAt: new Date(),
      rawPayload: mergeWorkflowMetadata(draft.rawPayload, {
        reviewState: "edited",
        lastEditedAt: new Date().toISOString()
      }),
      ...(input.values.bankData !== undefined
        ? {
            bankData: input.values.bankData === null ? Prisma.JsonNull : toNullablePrismaJson(input.values.bankData)
          }
        : {})
    }
  });

  const delta = buildDelta(
    {
      partyName: draft.partyName,
      cpfCnpj: draft.cpfCnpj,
      amount: draft.amount ? Number(draft.amount) : null,
      dueDate: draft.dueDate?.toISOString() ?? null,
      competence: draft.competence,
      description: draft.description,
      suggestedCategory: draft.suggestedCategory,
      finalCategory: draft.finalCategory,
      paymentMethod: draft.paymentMethod,
      bankData: draft.bankData,
      notes: draft.notes,
      legalEntityId: draft.legalEntityId,
      routingStatus: draft.routingStatus,
      routeSource: draft.routeSource,
      routingReason: draft.routingReason
    },
    {
      partyName: updated.partyName,
      cpfCnpj: updated.cpfCnpj,
      amount: updated.amount ? Number(updated.amount) : null,
      dueDate: updated.dueDate?.toISOString() ?? null,
      competence: updated.competence,
      description: updated.description,
      suggestedCategory: updated.suggestedCategory,
      finalCategory: updated.finalCategory,
      paymentMethod: updated.paymentMethod,
      bankData: updated.bankData,
      notes: updated.notes,
      legalEntityId: updated.legalEntityId,
      routingStatus: updated.routingStatus,
      routeSource: updated.routeSource,
      routingReason: updated.routingReason
    }
  );

  await createDraftReview({
    companyId: input.companyId,
    draftId: draft.id,
    userId: input.user.id,
    action: ReviewAction.EDIT,
    fieldDelta: delta
  });

  await writeAuditLog({
    companyId: input.companyId,
    userId: input.user.id,
    action: "financial_draft.edited",
    resource: "financial-draft",
    details: {
      draftId: draft.id,
      delta
    }
  });

  return updated;
}

export async function approveDraft(input: {
  draftId: string;
  companyId: string;
  user: Pick<User, "id" | "name" | "email">;
  note?: string | null;
  environment?: "HOMOLOG" | "PRODUCTION";
}) {
  const draft = await prisma.financialDraft.findFirstOrThrow({
    where: { id: input.draftId, companyId: input.companyId },
    include: {
      sourceEmail: true,
      sourceEvent: true
    }
  });

  if (draft.status === DraftStatus.APROVADO) {
    return draft;
  }

  const blockers = getDraftApprovalBlockers(draft);
  if (blockers.length > 0) {
    const message = blockers.map((blocker) => blocker.message).join(" ");
    throw new Error(message);
  }

  const updated = await prisma.financialDraft.update({
    where: { id: draft.id },
    data: {
      status: DraftStatus.APROVADO,
      reviewedAt: new Date(),
      rejectionReason: null,
      resultingResourceType: null,
      resultingResourceId: null,
      rawPayload: mergeWorkflowMetadata(draft.rawPayload, {
        reviewState: "approved",
        execution: {
          provider: "OMIE",
          environment: input.environment ?? "HOMOLOG",
          status: "queued",
          queuedAt: new Date().toISOString(),
          startedAt: null,
          finishedAt: null,
          retryCount: 0,
          lastError: null,
          externalPartyId: null,
          externalEntryId: null,
          requestPayload: null,
          responsePayload: null,
          billingArtifact: null
        }
      })
    }
  });

  if (draft.sourceEmailId) {
    await prisma.inboundEmail.update({
      where: { id: draft.sourceEmailId },
      data: {
        status: "APROVADO"
      }
    });
  }

  await createDraftReview({
    companyId: input.companyId,
    draftId: draft.id,
    userId: input.user.id,
    action: ReviewAction.APPROVE,
    note: input.note ?? null
  });

  await writeAuditLog({
    companyId: input.companyId,
    userId: input.user.id,
    action: "financial_draft.approved",
    resource: "financial-draft",
    details: {
      draftId: draft.id,
      executionProvider: "OMIE",
      executionEnvironment: input.environment ?? "HOMOLOG",
      executionStatus: "queued",
      note: input.note ?? null
    }
  });

  return updated;
}

export async function rejectDraft(input: {
  draftId: string;
  companyId: string;
  user: Pick<User, "id" | "name" | "email">;
  reason: string;
}) {
  const draft = await prisma.financialDraft.findFirstOrThrow({
    where: { id: input.draftId, companyId: input.companyId }
  });

  const updated = await prisma.financialDraft.update({
    where: { id: draft.id },
    data: {
      status: DraftStatus.REJEITADO,
      rejectionReason: input.reason,
      reviewedAt: new Date(),
      rawPayload: mergeWorkflowMetadata(draft.rawPayload, {
        reviewState: "rejected"
      })
    }
  });

  if (draft.sourceEmailId) {
    await prisma.inboundEmail.update({
      where: { id: draft.sourceEmailId },
      data: {
        status: "REJEITADO"
      }
    });
  }

  await createDraftReview({
    companyId: input.companyId,
    draftId: draft.id,
    userId: input.user.id,
    action: ReviewAction.REJECT,
    note: input.reason
  });

  await writeAuditLog({
    companyId: input.companyId,
    userId: input.user.id,
    action: "financial_draft.rejected",
    resource: "financial-draft",
    details: {
      draftId: draft.id,
      reason: input.reason
    }
  });

  return updated;
}

export async function markDraftAsDuplicate(input: {
  draftId: string;
  companyId: string;
  duplicateOfId: string;
  note?: string | null;
  user: Pick<User, "id" | "name" | "email">;
}) {
  const [draft, duplicateOf] = await Promise.all([
    prisma.financialDraft.findFirstOrThrow({
      where: {
        id: input.draftId,
        companyId: input.companyId
      }
    }),
    prisma.financialDraft.findFirstOrThrow({
      where: {
        id: input.duplicateOfId,
        companyId: input.companyId
      }
    })
  ]);

  if (draft.id === duplicateOf.id) {
    throw new Error("Draft cannot be marked as duplicate of itself.");
  }

  const updated = await prisma.financialDraft.update({
    where: { id: draft.id },
    data: {
      status: DraftStatus.REJEITADO,
      rejectionReason: input.note ?? "Marked as duplicate during review",
      reviewedAt: new Date(),
      rawPayload: mergeWorkflowMetadata(draft.rawPayload, {
        reviewState: "duplicated",
        duplicateOfId: duplicateOf.id,
        duplicateReason: input.note ?? null,
        duplicateMarkedAt: new Date().toISOString(),
        duplicateMarkedByUserId: input.user.id
      })
    }
  });

  await writeAuditLog({
    companyId: input.companyId,
    userId: input.user.id,
    action: "financial_draft.marked_duplicate",
    resource: "financial-draft",
    details: {
      draftId: draft.id,
      duplicateOfId: duplicateOf.id,
      note: input.note ?? null
    }
  });

  return updated;
}

export async function undoDraftDuplicate(input: {
  draftId: string;
  companyId: string;
  user: Pick<User, "id" | "name" | "email">;
}) {
  const draft = await prisma.financialDraft.findFirstOrThrow({
    where: {
      id: input.draftId,
      companyId: input.companyId
    }
  });

  const updated = await prisma.financialDraft.update({
    where: { id: draft.id },
    data: {
      status: DraftStatus.PENDENTE_REVISAO,
      rejectionReason: null,
      reviewedAt: new Date(),
      rawPayload: mergeWorkflowMetadata(draft.rawPayload, {
        reviewState: "pending_review",
        duplicateOfId: null,
        duplicateReason: null,
        duplicateMarkedAt: null,
        duplicateMarkedByUserId: null
      })
    }
  });

  await writeAuditLog({
    companyId: input.companyId,
    userId: input.user.id,
    action: "financial_draft.duplicate_undone",
    resource: "financial-draft",
    details: {
      draftId: draft.id
    }
  });

  return updated;
}

export async function requestDraftReprocess(input: {
  draftId: string;
  companyId: string;
  note?: string | null;
  user: Pick<User, "id" | "name" | "email">;
}) {
  const draft = await prisma.financialDraft.findFirstOrThrow({
    where: {
      id: input.draftId,
      companyId: input.companyId
    }
  });

  const updated = await prisma.financialDraft.update({
    where: { id: draft.id },
    data: {
      reviewedAt: new Date(),
      rawPayload: mergeWorkflowMetadata(draft.rawPayload, {
        reviewState: getDraftWorkflowStatus(draft),
        reprocessRequestedAt: new Date().toISOString(),
        reprocessRequestedByUserId: input.user.id,
        reprocessNote: input.note ?? null
      })
    }
  });

  await writeAuditLog({
    companyId: input.companyId,
    userId: input.user.id,
    action: "financial_draft.reprocess_requested",
    resource: "financial-draft",
    details: {
      draftId: draft.id,
      note: input.note ?? null
    }
  });

  return updated;
}
