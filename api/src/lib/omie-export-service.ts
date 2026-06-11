import {
  DraftStatus,
  ErpEnvironment,
  ErpProvider,
  ErpSyncEntityType,
  ErpSyncStatus,
  FinancialDirection,
  Prisma
} from "@prisma/client";
import { OmieClient } from "./omie-client.js";
import { resolveOmieConnection, touchOmieLastSync } from "./omie-connections.js";
import { extractOmieLabel, mapOmieDraftPayload, mapOmiePartyPayload, normalizeOmieLookupLabel } from "./omie-mapper.js";
import { prisma } from "./prisma.js";
import { toNullablePrismaJson, toPrismaJson } from "./prisma-json.js";
import { normalizeBrazilianDocument, upsertClientIdentity } from "./client-identity.js";

type ExecutionStatus = "idle" | "queued" | "running" | "success" | "error";

type DraftExecutionRecord = {
  provider: "OMIE";
  environment: ErpEnvironment;
  status: ExecutionStatus;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  retryCount: number;
  lastError: string | null;
  externalPartyId: string | null;
  externalEntryId: string | null;
  requestPayload: unknown;
  responsePayload: unknown;
  billingArtifact: unknown;
  lastAttemptSource: "approval" | "retry" | "manual";
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

function readExecution(rawPayload: unknown): DraftExecutionRecord | null {
  const workflow = asObject(asObject(rawPayload)._workflow);
  const execution = asObject(workflow.execution);
  if (Object.keys(execution).length === 0) {
    return null;
  }

  return {
    provider: "OMIE",
    environment:
      execution.environment === ErpEnvironment.PRODUCTION ? ErpEnvironment.PRODUCTION : ErpEnvironment.HOMOLOG,
    status: typeof execution.status === "string" ? (execution.status as ExecutionStatus) : "idle",
    queuedAt: typeof execution.queuedAt === "string" ? execution.queuedAt : null,
    startedAt: typeof execution.startedAt === "string" ? execution.startedAt : null,
    finishedAt: typeof execution.finishedAt === "string" ? execution.finishedAt : null,
    retryCount: typeof execution.retryCount === "number" ? execution.retryCount : 0,
    lastError: typeof execution.lastError === "string" ? execution.lastError : null,
    externalPartyId: typeof execution.externalPartyId === "string" ? execution.externalPartyId : null,
    externalEntryId: typeof execution.externalEntryId === "string" ? execution.externalEntryId : null,
    requestPayload: execution.requestPayload ?? null,
    responsePayload: execution.responsePayload ?? null,
    billingArtifact: execution.billingArtifact ?? null,
    lastAttemptSource:
      execution.lastAttemptSource === "retry" || execution.lastAttemptSource === "manual"
        ? execution.lastAttemptSource
        : "approval"
  };
}

function mergeExecution(rawPayload: unknown, patch: Partial<DraftExecutionRecord>) {
  const base = asObject(rawPayload);
  const workflow = asObject(base._workflow);
  const current = readExecution(rawPayload);
  const next: DraftExecutionRecord = {
    provider: "OMIE",
    environment: current?.environment ?? ErpEnvironment.HOMOLOG,
    status: current?.status ?? "idle",
    queuedAt: current?.queuedAt ?? null,
    startedAt: current?.startedAt ?? null,
    finishedAt: current?.finishedAt ?? null,
    retryCount: current?.retryCount ?? 0,
    lastError: current?.lastError ?? null,
    externalPartyId: current?.externalPartyId ?? null,
    externalEntryId: current?.externalEntryId ?? null,
    requestPayload: current?.requestPayload ?? null,
    responsePayload: current?.responsePayload ?? null,
    billingArtifact: current?.billingArtifact ?? null,
    lastAttemptSource: current?.lastAttemptSource ?? "approval",
    ...patch
  };

  return toPrismaJson({
    ...base,
    _workflow: {
      ...workflow,
      execution: next,
      reviewState: next.status === "success" ? "completed" : workflow.reviewState
    }
  });
}

function getFirstExternalId(records: Array<{ externalId: string | null }>) {
  const hit = records.find((item) => item.externalId);
  return hit?.externalId ?? null;
}

function getSyncLabel(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const data = payload as Record<string, unknown>;
  return extractOmieLabel(data);
}

function buildEntityType(direction: FinancialDirection) {
  return direction === FinancialDirection.CONTA_PAGAR
    ? ErpSyncEntityType.ACCOUNT_PAYABLE
    : ErpSyncEntityType.ACCOUNT_RECEIVABLE;
}

async function markSync(input: {
  companyId: string;
  connectionId: string;
  environment: ErpEnvironment;
  entityType: ErpSyncEntityType;
  internalId: string;
  draftId: string;
  status: ErpSyncStatus;
  externalId?: string | null;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorMessage?: string | null;
}) {
  return prisma.erpSyncRecord.upsert({
    where: {
      companyId_provider_environment_entityType_internalId: {
        companyId: input.companyId,
        provider: ErpProvider.OMIE,
        environment: input.environment,
        entityType: input.entityType,
        internalId: input.internalId
      }
    },
    update: {
      connectionId: input.connectionId,
      draftId: input.draftId,
      externalId: input.externalId ?? null,
      status: input.status,
      requestPayload: input.requestPayload === undefined ? undefined : toNullablePrismaJson(input.requestPayload),
      responsePayload: input.responsePayload === undefined ? undefined : toNullablePrismaJson(input.responsePayload),
      errorMessage: input.errorMessage ?? null,
      syncedAt: input.status === ErpSyncStatus.SUCCESS ? new Date() : null
    },
    create: {
      companyId: input.companyId,
      connectionId: input.connectionId,
      provider: ErpProvider.OMIE,
      environment: input.environment,
      entityType: input.entityType,
      internalId: input.internalId,
      draftId: input.draftId,
      externalId: input.externalId ?? null,
      status: input.status,
      requestPayload: input.requestPayload === undefined ? undefined : toNullablePrismaJson(input.requestPayload),
      responsePayload: input.responsePayload === undefined ? undefined : toNullablePrismaJson(input.responsePayload),
      errorMessage: input.errorMessage ?? null,
      syncedAt: input.status === ErpSyncStatus.SUCCESS ? new Date() : null
    }
  });
}

async function ensureLocalSupplier(input: {
  companyId: string;
  name: string;
  cpfCnpj: string | null;
  category: string | null;
}) {
  const existing = await prisma.supplier.findFirst({
    where: {
      companyId: input.companyId,
      OR: input.cpfCnpj
        ? [{ cnpj: normalizeBrazilianDocument(input.cpfCnpj) }, { name: input.name }]
        : [{ name: input.name }]
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.supplier.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      cnpj: normalizeBrazilianDocument(input.cpfCnpj),
      category: input.category ?? "A classificar",
      yearlySpend: 0,
      lastTransaction: "agora"
    }
  });
}

async function ensureLocalClient(input: {
  companyId: string;
  name: string;
  cpfCnpj: string | null;
}) {
  return upsertClientIdentity(prisma, {
    companyId: input.companyId,
    name: input.name,
    document: input.cpfCnpj,
    segment: "Automacao Financeira",
    status: "Ativo",
    sinceYear: new Date().getUTCFullYear()
  });
}

async function ensurePartyExternalId(input: {
  companyId: string;
  connectionId: string;
  environment: ErpEnvironment;
  direction: FinancialDirection;
  draftId: string;
  partyName: string;
  cpfCnpj: string | null;
  category: string | null;
  client: OmieClient;
  context: {
    companyId: string;
    connectionId: string;
    draftId: string;
    triggeredByUserId: string;
  };
  syncRecords: Array<{
    entityType: ErpSyncEntityType;
    internalId: string;
    externalId: string | null;
    requestPayload: Prisma.JsonValue | null;
    responsePayload: Prisma.JsonValue | null;
  }>;
}) {
  if (input.direction === FinancialDirection.CONTA_PAGAR) {
    const supplier = await ensureLocalSupplier({
      companyId: input.companyId,
      name: input.partyName,
      cpfCnpj: input.cpfCnpj,
      category: input.category
    });
    const mapped = getFirstExternalId(
      input.syncRecords.filter(
        (record) => record.entityType === ErpSyncEntityType.SUPPLIER && record.internalId === supplier.id
      )
    );
    if (mapped) {
      return {
        localPartyId: supplier.id,
        externalPartyId: mapped
      };
    }

    const payload = mapOmiePartyPayload({
      integrationCode: supplier.id,
      name: input.partyName,
      cpfCnpj: input.cpfCnpj
    });
    const response = await input.client.createParty(payload, input.context);
    const externalPartyId =
      response.codigo_cliente_omie == null && response.codigo_cliente_fornecedor == null
        ? null
        : String(response.codigo_cliente_omie ?? response.codigo_cliente_fornecedor);
    if (!externalPartyId) {
      throw new Error("OMIE supplier creation did not return an external id");
    }
    await markSync({
      companyId: input.companyId,
      connectionId: input.connectionId,
      environment: input.environment,
      entityType: ErpSyncEntityType.SUPPLIER,
      internalId: supplier.id,
      draftId: input.draftId,
      status: ErpSyncStatus.SUCCESS,
      externalId: externalPartyId,
      requestPayload: payload,
      responsePayload: response
    });

    return {
      localPartyId: supplier.id,
      externalPartyId
    };
  }

  const clientRecord = await ensureLocalClient({
    companyId: input.companyId,
    name: input.partyName,
    cpfCnpj: input.cpfCnpj
  });
  const mapped = getFirstExternalId(
    input.syncRecords.filter((record) => record.entityType === ErpSyncEntityType.CLIENT && record.internalId === clientRecord.id)
  );
  if (mapped) {
    return {
      localPartyId: clientRecord.id,
      externalPartyId: mapped
    };
  }

  const payload = mapOmiePartyPayload({
    integrationCode: clientRecord.id,
    name: input.partyName,
    cpfCnpj: input.cpfCnpj
  });
  const response = await input.client.createParty(payload, input.context);
  const externalPartyId =
    response.codigo_cliente_omie == null && response.codigo_cliente_fornecedor == null
      ? null
      : String(response.codigo_cliente_omie ?? response.codigo_cliente_fornecedor);
  if (!externalPartyId) {
    throw new Error("OMIE client creation did not return an external id");
  }
  await markSync({
    companyId: input.companyId,
    connectionId: input.connectionId,
    environment: input.environment,
    entityType: ErpSyncEntityType.CLIENT,
    internalId: clientRecord.id,
    draftId: input.draftId,
    status: ErpSyncStatus.SUCCESS,
    externalId: externalPartyId,
    requestPayload: payload,
    responsePayload: response
  });

  return {
    localPartyId: clientRecord.id,
    externalPartyId
  };
}

async function ensureMirrorRecord(input: {
  companyId: string;
  draft: {
    id: string;
    direction: FinancialDirection;
    amount: Prisma.Decimal | number | null;
    dueDate: Date | null;
    description: string;
    finalCategory: string | null;
    suggestedCategory: string | null;
    confidenceScore: number;
    paymentMethod: string | null;
    resultingResourceId: string | null;
    resultingResourceType: string | null;
  };
  localPartyId: string;
  externalEntryId: string | null;
}) {
  if (input.draft.direction === FinancialDirection.CONTA_PAGAR) {
    const payable = await prisma.accountPayable.create({
      data: {
        companyId: input.companyId,
        supplierId: input.localPartyId,
        amount: input.draft.amount ?? 0,
        dueDate: input.draft.dueDate ?? new Date(),
        category: input.draft.finalCategory ?? input.draft.suggestedCategory ?? "A classificar",
        status: "PROCESSADO",
        confidence: input.draft.confidenceScore / 100,
        source: `OMIE:${input.externalEntryId ?? "queued"}`,
        assignee: "Integracao OMIE"
      }
    });

    return {
      resultingResourceType: "account-payable",
      resultingResourceId: payable.id
    };
  }

  const receivable = await prisma.accountReceivable.create({
    data: {
      companyId: input.companyId,
      clientId: input.localPartyId,
      amount: input.draft.amount ?? 0,
      dueDate: input.draft.dueDate ?? new Date(),
      status: "PROCESSADO",
      source: `OMIE:${input.externalEntryId ?? "queued"}`,
      channel: input.draft.paymentMethod ?? "A classificar"
    }
  });

  return {
    resultingResourceType: "account-receivable",
    resultingResourceId: receivable.id
  };
}

async function executeApprovedDraft(input: {
  companyId: string;
  draftId: string;
  environment: ErpEnvironment;
  triggeredByUserId: string;
  source: "approval" | "retry" | "manual";
}) {
  const draft = await prisma.financialDraft.findFirstOrThrow({
    where: {
      id: input.draftId,
      companyId: input.companyId
    }
  });

  if (draft.status !== DraftStatus.APROVADO) {
    throw new Error("Only approved drafts can be sent to OMIE");
  }

  if (!draft.amount || !draft.dueDate || !draft.description.trim().length || !draft.legalEntityId) {
    throw new Error("Draft is missing required fields for OMIE execution");
  }

  const entityType = buildEntityType(draft.direction);
  const execution = readExecution(draft.rawPayload);
  if (execution?.status === "success" && execution.externalEntryId) {
    return {
      draftId: draft.id,
      environment: input.environment,
      status: "success" as const,
      externalId: execution.externalEntryId,
      provider: "OMIE" as const,
      replayed: false
    };
  }

  const connection = await resolveOmieConnection(input.companyId, draft.legalEntityId, input.environment);
  const duplicate = await prisma.erpSyncRecord.findUnique({
    where: {
      companyId_provider_environment_entityType_internalId: {
        companyId: input.companyId,
        provider: ErpProvider.OMIE,
        environment: input.environment,
        entityType,
        internalId: draft.id
      }
    }
  });
  if (duplicate?.status === ErpSyncStatus.SUCCESS && duplicate.externalId) {
    await prisma.financialDraft.update({
      where: { id: draft.id },
      data: {
        rawPayload: mergeExecution(draft.rawPayload, {
          environment: input.environment,
          status: "success",
          finishedAt: new Date().toISOString(),
          lastError: null,
          externalEntryId: duplicate.externalId,
          lastAttemptSource: input.source
        })
      }
    });
    return {
      draftId: draft.id,
      environment: input.environment,
      status: "success" as const,
      externalId: duplicate.externalId,
      provider: "OMIE" as const,
      replayed: true
    };
  }

  await prisma.financialDraft.update({
    where: { id: draft.id },
    data: {
      rawPayload: mergeExecution(draft.rawPayload, {
        environment: input.environment,
        status: "running",
        queuedAt: execution?.queuedAt ?? new Date().toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: null,
        lastError: null,
        retryCount: input.source === "retry" ? (execution?.retryCount ?? 0) + 1 : execution?.retryCount ?? 0,
        lastAttemptSource: input.source
      })
    }
  });

  const syncRecords = await prisma.erpSyncRecord.findMany({
    where: {
      companyId: input.companyId,
      provider: ErpProvider.OMIE,
      environment: input.environment,
      connectionId: connection.id,
      status: ErpSyncStatus.SUCCESS
    }
  });

  let payload: Record<string, unknown> | null = null;
  let providerResponse: unknown = null;
  let externalPartyId: string | null = execution?.externalPartyId ?? null;

  try {
    const client = new OmieClient(connection);
    const context = {
      companyId: input.companyId,
      connectionId: connection.id,
      draftId: draft.id,
      triggeredByUserId: input.triggeredByUserId
    };
    const normalizedCategory = normalizeOmieLookupLabel(draft.finalCategory ?? draft.suggestedCategory);
    const categoryRecord = syncRecords.find(
      (record) =>
        record.entityType === ErpSyncEntityType.CATEGORY &&
        normalizeOmieLookupLabel(getSyncLabel(record.requestPayload) ?? getSyncLabel(record.responsePayload)) === normalizedCategory
    );
    if (!categoryRecord?.externalId) {
      throw new Error("Category has no OMIE catalog mapping");
    }

    let currentAccountRecord = syncRecords.find((record) => record.entityType === ErpSyncEntityType.CURRENT_ACCOUNT);
    const bankData = draft.bankData && typeof draft.bankData === "object" ? (draft.bankData as Record<string, unknown>) : null;
    const preferredAccountId = bankData?.omieCurrentAccountId == null ? null : String(bankData.omieCurrentAccountId);
    if (preferredAccountId) {
      currentAccountRecord = syncRecords.find(
        (record) => record.entityType === ErpSyncEntityType.CURRENT_ACCOUNT && record.externalId === preferredAccountId
      );
    }
    if (!currentAccountRecord?.externalId) {
      throw new Error("Current account has no OMIE catalog mapping");
    }

    const party = await ensurePartyExternalId({
      companyId: input.companyId,
      connectionId: connection.id,
      environment: input.environment,
      direction: draft.direction,
      draftId: draft.id,
      partyName: draft.partyName,
      cpfCnpj: draft.cpfCnpj ?? null,
      category: draft.finalCategory ?? draft.suggestedCategory,
      client,
      context,
      syncRecords
    });
    externalPartyId = party.externalPartyId;

    payload = mapOmieDraftPayload({
      draft: {
        id: draft.id,
        direction: draft.direction,
        amount: Number(draft.amount),
        dueDate: draft.dueDate,
        description: draft.description,
        notes: draft.notes
      },
      partyExternalId: party.externalPartyId,
      categoryExternalId: categoryRecord.externalId,
      currentAccountExternalId: currentAccountRecord.externalId
    });

    providerResponse =
      draft.direction === FinancialDirection.CONTA_PAGAR
        ? await client.createPayable(payload, context)
        : await client.createReceivable(payload, context);
    const externalEntryId =
      providerResponse &&
      typeof providerResponse === "object" &&
      "codigo_lancamento_omie" in providerResponse &&
      (providerResponse as Record<string, unknown>).codigo_lancamento_omie != null
        ? String((providerResponse as Record<string, unknown>).codigo_lancamento_omie)
        : null;

    await markSync({
      companyId: input.companyId,
      connectionId: connection.id,
      environment: input.environment,
      entityType,
      internalId: draft.id,
      draftId: draft.id,
      status: ErpSyncStatus.SUCCESS,
      externalId: externalEntryId,
      requestPayload: payload,
      responsePayload: providerResponse
    });

    const mirror = await ensureMirrorRecord({
      companyId: input.companyId,
      draft,
      localPartyId: party.localPartyId,
      externalEntryId
    });

    await prisma.financialDraft.update({
      where: { id: draft.id },
      data: {
        resultingResourceType: mirror.resultingResourceType,
        resultingResourceId: mirror.resultingResourceId,
        rawPayload: mergeExecution(draft.rawPayload, {
          environment: input.environment,
          status: "success",
          startedAt: execution?.startedAt ?? new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          lastError: null,
          externalPartyId,
          externalEntryId,
          requestPayload: payload,
          responsePayload: providerResponse,
          billingArtifact:
            draft.direction === FinancialDirection.CONTA_RECEBER
              ? {
                  externalEntryId
                }
              : null,
          lastAttemptSource: input.source
        })
      }
    });

    await touchOmieLastSync(connection.id);

    return {
      draftId: draft.id,
      environment: input.environment,
      status: "success" as const,
      externalId: externalEntryId,
      provider: "OMIE" as const,
      replayed: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OMIE execution failed";
    await markSync({
      companyId: input.companyId,
      connectionId: connection.id,
      environment: input.environment,
      entityType,
      internalId: draft.id,
      draftId: draft.id,
      status: ErpSyncStatus.ERROR,
      requestPayload: payload,
      responsePayload: providerResponse,
      errorMessage: message
    });
    await prisma.financialDraft.update({
      where: { id: draft.id },
      data: {
        rawPayload: mergeExecution(draft.rawPayload, {
          environment: input.environment,
          status: "error",
          finishedAt: new Date().toISOString(),
          lastError: message,
          externalPartyId,
          requestPayload: payload,
          responsePayload: providerResponse,
          lastAttemptSource: input.source
        })
      }
    });

    return {
      draftId: draft.id,
      environment: input.environment,
      status: "error" as const,
      externalId: null,
      provider: "OMIE" as const,
      replayed: false,
      errorMessage: message
    };
  }
}

export async function runApprovedDraftExecution(input: {
  companyId: string;
  draftId: string;
  environment: ErpEnvironment;
  triggeredByUserId: string;
}) {
  return executeApprovedDraft({
    ...input,
    source: "approval"
  });
}

export async function retryDraftExecution(input: {
  companyId: string;
  draftId: string;
  environment: ErpEnvironment;
  triggeredByUserId: string;
}) {
  const draft = await prisma.financialDraft.findFirstOrThrow({
    where: {
      id: input.draftId,
      companyId: input.companyId
    }
  });
  const execution = readExecution(draft.rawPayload);
  if (draft.status !== DraftStatus.APROVADO || execution?.status !== "error") {
    throw new Error("Only failed approved drafts can be retried.");
  }

  await prisma.financialDraft.update({
    where: { id: draft.id },
    data: {
      rawPayload: mergeExecution(draft.rawPayload, {
        status: "queued",
        queuedAt: new Date().toISOString(),
        finishedAt: null,
        lastError: null,
        lastAttemptSource: "retry"
      })
    }
  });

  return executeApprovedDraft({
    ...input,
    source: "retry"
  });
}

export async function exportDraftToOmie(input: {
  companyId: string;
  draftId: string;
  environment: ErpEnvironment;
  triggeredByUserId: string;
}) {
  return executeApprovedDraft({
    ...input,
    source: "manual"
  });
}
