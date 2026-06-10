import { DraftRouteSource, DraftRoutingStatus, FinancialDirection, type FinancialDraft, type LegalEntity } from "@prisma/client";
import { Prisma } from "@prisma/client";

export type AllocationStrategy = "MANUAL" | "PERCENTAGE" | "VALUE_BAND" | "GROUP";

export type ContractSnapshotInput = {
  originId: string;
  businessClientId: string;
  businessClientName?: string;
  amount: number;
  dueDate: string;
  category: string | null;
  description: string;
  scheduleReason: string;
  tags?: string[];
};

export type ServiceOrderSnapshotInput = {
  originId: string;
  businessClientId: string;
  businessClientName?: string;
  amount: number;
  dueDate: string;
  category: string | null;
  description: string;
  faturavel: boolean;
  tags?: string[];
};

export type AllocationRuleInput = {
  strategy: AllocationStrategy;
  legalEntityId?: string | null;
  percentageMap?: Array<{ legalEntityId: string; percentage: number }>;
  valueBands?: Array<{ legalEntityId: string; min: number; max: number | null }>;
  groupMap?: Array<{ legalEntityId: string; tag: string }>;
  monthlyCapMap?: Array<{ legalEntityId: string; cap: number; used: number }>;
};

export type ReconciliationMovementInput = {
  id: string;
  direction: "IN" | "OUT";
  amount: number;
  description: string;
  occurredAt: string;
  suggestedPartyName?: string | null;
};

export type ReconciliationCandidateInput = {
  id: string;
  amount: number;
  description: string;
  occurredAt?: string | null;
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getAdvancedOriginId(draft: Pick<FinancialDraft, "rawPayload">) {
  if (!draft.rawPayload || typeof draft.rawPayload !== "object") {
    return null;
  }
  const raw = draft.rawPayload as Record<string, unknown>;
  const advanced = raw._advancedOps;
  if (!advanced || typeof advanced !== "object") {
    return null;
  }
  const data = advanced as Record<string, unknown>;
  return typeof data.originId === "string" ? data.originId : null;
}

export function allocateLegalEntity(input: {
  amount: number;
  tags?: string[];
  legalEntities: Array<Pick<LegalEntity, "id" | "isDefault">>;
  rule?: AllocationRuleInput | null;
}) {
  const fallback =
    input.legalEntities.find((entity) => entity.isDefault)?.id ??
    input.legalEntities[0]?.id ??
    null;
  const rule = input.rule;
  if (!rule) {
    return {
      legalEntityId: fallback,
      strategy: "DEFAULT"
    };
  }

  if (rule.strategy === "MANUAL" && rule.legalEntityId) {
    return {
      legalEntityId: rule.legalEntityId,
      strategy: rule.strategy
    };
  }

  if (rule.strategy === "GROUP" && rule.groupMap?.length) {
    const tagSet = new Set((input.tags ?? []).map(normalizeText));
    const hit = rule.groupMap.find((item) => tagSet.has(normalizeText(item.tag)));
    if (hit) {
      return {
        legalEntityId: hit.legalEntityId,
        strategy: rule.strategy
      };
    }
  }

  if (rule.strategy === "VALUE_BAND" && rule.valueBands?.length) {
    const hit = rule.valueBands.find((item) => input.amount >= item.min && (item.max == null || input.amount <= item.max));
    if (hit) {
      return {
        legalEntityId: hit.legalEntityId,
        strategy: rule.strategy
      };
    }
  }

  if (rule.strategy === "PERCENTAGE" && rule.percentageMap?.length) {
    const available = rule.percentageMap
      .filter((item) => !rule.monthlyCapMap?.some((cap) => cap.legalEntityId === item.legalEntityId && cap.used >= cap.cap))
      .sort((left, right) => right.percentage - left.percentage);
    if (available[0]) {
      return {
        legalEntityId: available[0].legalEntityId,
        strategy: rule.strategy
      };
    }
  }

  return {
    legalEntityId: fallback,
    strategy: "DEFAULT"
  };
}

export function detectDueContracts(input: {
  contracts: ContractSnapshotInput[];
  existingDrafts: Array<Pick<FinancialDraft, "rawPayload">>;
  referenceDate: Date;
}) {
  const knownOrigins = new Set(input.existingDrafts.map(getAdvancedOriginId).filter((value): value is string => Boolean(value)));
  const referenceKey = input.referenceDate.toISOString().slice(0, 10);

  return input.contracts
    .filter((contract) => contract.dueDate.slice(0, 10) <= referenceKey)
    .filter((contract) => !knownOrigins.has(contract.originId))
    .map((contract) => ({
      ...contract,
      originType: "omie_contract" as const
    }));
}

export function detectBillableServiceOrders(input: {
  serviceOrders: ServiceOrderSnapshotInput[];
  existingDrafts: Array<Pick<FinancialDraft, "rawPayload">>;
}) {
  const knownOrigins = new Set(input.existingDrafts.map(getAdvancedOriginId).filter((value): value is string => Boolean(value)));

  return input.serviceOrders
    .filter((serviceOrder) => serviceOrder.faturavel)
    .filter((serviceOrder) => !knownOrigins.has(serviceOrder.originId))
    .map((serviceOrder) => ({
      ...serviceOrder,
      originType: "omie_os" as const
    }));
}

export function classifyReconciliationMovement(input: {
  movement: ReconciliationMovementInput;
  candidates: ReconciliationCandidateInput[];
  knownFeeLabels?: string[];
}) {
  const normalizedDescription = normalizeText(input.movement.description);
  const feeLabels = (input.knownFeeLabels ?? []).map(normalizeText);

  if (feeLabels.some((label) => normalizedDescription.includes(label))) {
    return {
      classification: "fee" as const,
      confidence: 0.99,
      matchedCandidateId: null
    };
  }

  const duplicate = input.candidates.find(
    (candidate) =>
      candidate.amount === input.movement.amount &&
      normalizeText(candidate.description) === normalizedDescription
  );
  if (duplicate) {
    return {
      classification: "duplicate" as const,
      confidence: 0.96,
      matchedCandidateId: duplicate.id
    };
  }

  const amountMatch = input.candidates.find((candidate) => candidate.amount === input.movement.amount);
  if (amountMatch) {
    const similarDescription =
      normalizeText(amountMatch.description) === normalizedDescription ||
      normalizeText(amountMatch.description).includes(normalizedDescription) ||
      normalizedDescription.includes(normalizeText(amountMatch.description));
    return {
      classification: similarDescription ? ("auto_reconciled" as const) : ("pending" as const),
      confidence: similarDescription ? 0.98 : 0.74,
      matchedCandidateId: amountMatch.id
    };
  }

  return {
    classification: "divergent" as const,
    confidence: 0.42,
    matchedCandidateId: null
  };
}

export function buildOperationalBi(input: {
  drafts: Array<{
    id: string;
    createdAt: Date;
    status: string;
    partyName: string;
    rawPayload: unknown;
  }>;
  receivables: Array<{
    id: string;
    amount: number;
    clientId: string | null;
    createdAt: Date;
    status: string;
  }>;
  reconciliationCount: number;
}) {
  const contractDrafts = input.drafts.filter((draft) => {
    const raw = draft.rawPayload && typeof draft.rawPayload === "object" ? (draft.rawPayload as Record<string, unknown>) : {};
    const advanced = raw._advancedOps && typeof raw._advancedOps === "object" ? (raw._advancedOps as Record<string, unknown>) : {};
    return advanced.originType === "omie_contract";
  });
  const osDrafts = input.drafts.filter((draft) => {
    const raw = draft.rawPayload && typeof draft.rawPayload === "object" ? (draft.rawPayload as Record<string, unknown>) : {};
    const advanced = raw._advancedOps && typeof raw._advancedOps === "object" ? (raw._advancedOps as Record<string, unknown>) : {};
    return advanced.originType === "omie_os";
  });

  return {
    dueContracts: contractDrafts.length,
    dueServiceOrders: osDrafts.length,
    reconciliationCount: input.reconciliationCount,
    approvedDrafts: input.drafts.filter((draft) => draft.status === "APROVADO").length,
    receivableVolume: input.receivables.reduce((sum, item) => sum + item.amount, 0)
  };
}

export function buildDraftPayload(input: {
  sourceLabel: string;
  originType: "omie_contract" | "omie_os" | "reconciliation";
  originId: string;
  businessClientId?: string | null;
  businessClientName: string;
  amount: number;
  dueDate: string;
  description: string;
  category: string | null;
  legalEntityId: string | null;
  routeReason: string;
  evidence: string[];
  extra: Record<string, unknown>;
}) {
  return {
    direction: FinancialDirection.CONTA_RECEBER,
    partyName: input.businessClientName,
    cpfCnpj: null,
    amount: input.amount,
    dueDate: new Date(input.dueDate),
    competence: input.dueDate.slice(0, 7),
    description: input.description,
    suggestedCategory: input.category ?? "A classificar",
    finalCategory: input.category ?? "A classificar",
    paymentMethod: "OMIE",
    bankData: Prisma.JsonNull,
    notes: `${input.sourceLabel} generated into shared review flow`,
    evidence: input.evidence,
    rawPayload: {
      _advancedOps: {
        originType: input.originType,
        originId: input.originId,
        businessClientId: input.businessClientId ?? null,
        businessClientName: input.businessClientName,
        ...input.extra
      }
    },
    confidenceScore: 100,
    confidenceBand: "ALTA" as const,
    status: "PENDENTE_REVISAO" as const,
    sourceLabel: input.sourceLabel,
    legalEntityId: input.legalEntityId,
    routingStatus: input.legalEntityId ? DraftRoutingStatus.ROUTED : DraftRoutingStatus.UNROUTED,
    routeSource: input.legalEntityId ? DraftRouteSource.MANUAL : DraftRouteSource.UNKNOWN,
    routingReason: input.routeReason
  };
}
