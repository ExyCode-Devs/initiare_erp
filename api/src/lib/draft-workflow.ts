import { DraftStatus, Prisma, ReviewAction, type User } from "@prisma/client";
import { prisma } from "./prisma.js";
import { writeAuditLog } from "./audit.js";
import { toNullablePrismaJson } from "./prisma-json.js";

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
      reviewedAt: new Date(),
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
      notes: draft.notes
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
      notes: updated.notes
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

async function upsertSupplier(companyId: string, name: string, cnpj: string | null, category: string | null) {
  const existing = await prisma.supplier.findFirst({
    where: {
      companyId,
      OR: cnpj ? [{ cnpj }, { name }] : [{ name }]
    }
  });

  if (existing) {
    return prisma.supplier.update({
      where: { id: existing.id },
      data: {
        cnpj: cnpj ?? existing.cnpj,
        category: category ?? existing.category,
        lastTransaction: "agora"
      }
    });
  }

  return prisma.supplier.create({
    data: {
      companyId,
      name,
      cnpj,
      category: category ?? "A classificar",
      yearlySpend: 0,
      lastTransaction: "agora"
    }
  });
}

async function upsertClient(companyId: string, name: string) {
  const existing = await prisma.client.findFirst({
    where: {
      companyId,
      name
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.client.create({
    data: {
      companyId,
      name,
      segment: "Automacao Financeira",
      annualRevenue: 0,
      status: "Ativo",
      sinceYear: new Date().getUTCFullYear()
    }
  });
}

export async function approveDraft(input: {
  draftId: string;
  companyId: string;
  user: Pick<User, "id" | "name" | "email">;
  note?: string | null;
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

  let resultingResourceType: string;
  let resultingResourceId: string;

  if (draft.direction === "CONTA_PAGAR") {
    const supplier = await upsertSupplier(input.companyId, draft.partyName, draft.cpfCnpj ?? null, draft.finalCategory);
    const payable = await prisma.accountPayable.create({
      data: {
        companyId: input.companyId,
        supplierId: supplier.id,
        amount: draft.amount ?? 0,
        dueDate: draft.dueDate ?? new Date(),
        category: draft.finalCategory ?? draft.suggestedCategory ?? "A classificar",
        status: "EM_REVISAO",
        confidence: draft.confidenceScore / 100,
        source: "AI Gateway",
        assignee: input.user.name
      }
    });
    resultingResourceType = "account-payable";
    resultingResourceId = payable.id;
  } else {
    const client = await upsertClient(input.companyId, draft.partyName);
    const receivable = await prisma.accountReceivable.create({
      data: {
        companyId: input.companyId,
        clientId: client.id,
        amount: draft.amount ?? 0,
        dueDate: draft.dueDate ?? new Date(),
        status: "EM_REVISAO",
        source: "AI Gateway",
        channel: draft.paymentMethod ?? "A classificar"
      }
    });
    resultingResourceType = "account-receivable";
    resultingResourceId = receivable.id;
  }

  const updated = await prisma.financialDraft.update({
    where: { id: draft.id },
    data: {
      status: DraftStatus.APROVADO,
      reviewedAt: new Date(),
      rejectionReason: null,
      resultingResourceType,
      resultingResourceId
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
      resultingResourceType,
      resultingResourceId,
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
      reviewedAt: new Date()
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
