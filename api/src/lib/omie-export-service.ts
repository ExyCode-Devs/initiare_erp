import {
  DraftStatus,
  ErpEnvironment,
  ErpProvider,
  ErpSyncEntityType,
  ErpSyncStatus,
  FinancialDirection
} from "@prisma/client";
import { OmieClient } from "./omie-client.js";
import { resolveOmieConnection, touchOmieLastSync } from "./omie-connections.js";
import { extractOmieLabel, mapOmieDraftPayload, normalizeOmieLookupLabel } from "./omie-mapper.js";
import { prisma } from "./prisma.js";
import { toNullablePrismaJson } from "./prisma-json.js";

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

async function markSyncBlocked(input: {
  companyId: string;
  connectionId: string;
  environment: ErpEnvironment;
  entityType: ErpSyncEntityType;
  internalId: string;
  draftId: string;
  errorMessage: string;
}) {
  await prisma.erpSyncRecord.upsert({
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
      status: ErpSyncStatus.BLOCKED,
      errorMessage: input.errorMessage,
      syncedAt: null
    },
    create: {
      companyId: input.companyId,
      connectionId: input.connectionId,
      provider: ErpProvider.OMIE,
      environment: input.environment,
      entityType: input.entityType,
      internalId: input.internalId,
      draftId: input.draftId,
      status: ErpSyncStatus.BLOCKED,
      errorMessage: input.errorMessage
    }
  });
}

export async function exportDraftToOmie(input: {
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

  if (draft.status !== DraftStatus.APROVADO) {
    throw new Error("Only approved drafts can be exported to OMIE");
  }

  if (!draft.amount || !draft.dueDate || !draft.description.trim().length) {
    throw new Error("Draft is missing required fields for OMIE export");
  }

  if (!draft.legalEntityId) {
    throw new Error("Draft has no routed legal entity");
  }

  const connection = await resolveOmieConnection(input.companyId, draft.legalEntityId, input.environment);
  const duplicate = await prisma.erpSyncRecord.findUnique({
    where: {
      companyId_provider_environment_entityType_internalId: {
        companyId: input.companyId,
        provider: ErpProvider.OMIE,
        environment: input.environment,
        entityType:
          draft.direction === FinancialDirection.CONTA_PAGAR
            ? ErpSyncEntityType.ACCOUNT_PAYABLE
            : ErpSyncEntityType.ACCOUNT_RECEIVABLE,
        internalId: draft.id
      }
    }
  });

  if (duplicate?.status === ErpSyncStatus.SUCCESS && duplicate.externalId) {
    throw new Error("Draft already exported to OMIE for this environment");
  }

  const [suppliers, clients, syncRecords] = await Promise.all([
    draft.direction === FinancialDirection.CONTA_PAGAR
      ? prisma.supplier.findMany({ where: { companyId: input.companyId } })
      : Promise.resolve([]),
    draft.direction === FinancialDirection.CONTA_RECEBER
      ? prisma.client.findMany({ where: { companyId: input.companyId } })
      : Promise.resolve([]),
    prisma.erpSyncRecord.findMany({
      where: {
        companyId: input.companyId,
        provider: ErpProvider.OMIE,
        environment: input.environment,
        connectionId: connection.id,
        status: ErpSyncStatus.SUCCESS
      }
    })
  ]);

  const normalizedPartyName = normalizeOmieLookupLabel(draft.partyName);
  const normalizedDocument = normalizeOmieLookupLabel(draft.cpfCnpj);
  const normalizedCategory = normalizeOmieLookupLabel(draft.finalCategory ?? draft.suggestedCategory);

  let partyInternalId: string | null = null;
  if (draft.direction === FinancialDirection.CONTA_PAGAR) {
    const supplier = suppliers.find(
      (item) =>
        normalizeOmieLookupLabel(item.name) === normalizedPartyName ||
        (normalizedDocument.length > 0 && normalizeOmieLookupLabel(item.cnpj) === normalizedDocument)
    );
    partyInternalId = supplier?.id ?? null;
    if (!partyInternalId) {
      await markSyncBlocked({
        companyId: input.companyId,
        connectionId: connection.id,
        environment: input.environment,
        entityType: ErpSyncEntityType.ACCOUNT_PAYABLE,
        internalId: draft.id,
        draftId: draft.id,
        errorMessage: "Supplier not mapped locally for OMIE export"
      });
      throw new Error("Supplier not mapped locally for OMIE export");
    }
  } else {
    const client = clients.find((item) => normalizeOmieLookupLabel(item.name) === normalizedPartyName);
    partyInternalId = client?.id ?? null;
    if (!partyInternalId) {
      await markSyncBlocked({
        companyId: input.companyId,
        connectionId: connection.id,
        environment: input.environment,
        entityType: ErpSyncEntityType.ACCOUNT_RECEIVABLE,
        internalId: draft.id,
        draftId: draft.id,
        errorMessage: "Client not mapped locally for OMIE export"
      });
      throw new Error("Client not mapped locally for OMIE export");
    }
  }

  const partyExternalId = getFirstExternalId(
    syncRecords.filter(
      (record) =>
        record.entityType ===
          (draft.direction === FinancialDirection.CONTA_PAGAR ? ErpSyncEntityType.SUPPLIER : ErpSyncEntityType.CLIENT) &&
        record.internalId === partyInternalId
    )
  );
  if (!partyExternalId) {
    await markSyncBlocked({
      companyId: input.companyId,
      connectionId: connection.id,
      environment: input.environment,
      entityType: draft.direction === FinancialDirection.CONTA_PAGAR ? ErpSyncEntityType.ACCOUNT_PAYABLE : ErpSyncEntityType.ACCOUNT_RECEIVABLE,
      internalId: draft.id,
      draftId: draft.id,
      errorMessage: "Party has no OMIE catalog mapping"
    });
    throw new Error("Party has no OMIE catalog mapping");
  }

  const categoryRecord = syncRecords.find(
    (record) =>
      record.entityType === ErpSyncEntityType.CATEGORY &&
      normalizeOmieLookupLabel(getSyncLabel(record.requestPayload) ?? getSyncLabel(record.responsePayload)) === normalizedCategory
  );
  if (!categoryRecord?.externalId) {
    await markSyncBlocked({
      companyId: input.companyId,
      connectionId: connection.id,
      environment: input.environment,
      entityType: draft.direction === FinancialDirection.CONTA_PAGAR ? ErpSyncEntityType.ACCOUNT_PAYABLE : ErpSyncEntityType.ACCOUNT_RECEIVABLE,
      internalId: draft.id,
      draftId: draft.id,
      errorMessage: "Category has no OMIE catalog mapping"
    });
    throw new Error("Category has no OMIE catalog mapping");
  }

  let currentAccountRecord = syncRecords.find((record) => record.entityType === ErpSyncEntityType.CURRENT_ACCOUNT);
  const bankData = draft.bankData && typeof draft.bankData === "object" ? (draft.bankData as Record<string, unknown>) : null;
  const preferredAccountId =
    bankData?.omieCurrentAccountId == null ? null : String(bankData.omieCurrentAccountId);
  if (preferredAccountId) {
    currentAccountRecord = syncRecords.find(
      (record) => record.entityType === ErpSyncEntityType.CURRENT_ACCOUNT && record.externalId === preferredAccountId
    );
  }

  if (!currentAccountRecord?.externalId) {
    await markSyncBlocked({
      companyId: input.companyId,
      connectionId: connection.id,
      environment: input.environment,
      entityType: draft.direction === FinancialDirection.CONTA_PAGAR ? ErpSyncEntityType.ACCOUNT_PAYABLE : ErpSyncEntityType.ACCOUNT_RECEIVABLE,
      internalId: draft.id,
      draftId: draft.id,
      errorMessage: "Current account has no OMIE catalog mapping"
    });
    throw new Error("Current account has no OMIE catalog mapping");
  }

  const payload = mapOmieDraftPayload({
    draft: {
      id: draft.id,
      direction: draft.direction,
      amount: Number(draft.amount),
      dueDate: draft.dueDate,
      description: draft.description,
      notes: draft.notes
    },
    partyExternalId,
    categoryExternalId: categoryRecord.externalId,
    currentAccountExternalId: currentAccountRecord.externalId
  });

  const client = new OmieClient(connection);
  const context = {
    companyId: input.companyId,
    connectionId: connection.id,
    draftId: draft.id,
    triggeredByUserId: input.triggeredByUserId
  };

  try {
    const response =
      draft.direction === FinancialDirection.CONTA_PAGAR
        ? await client.createPayable(payload, context)
        : await client.createReceivable(payload, context);
    const externalId = response.codigo_lancamento_omie == null ? null : String(response.codigo_lancamento_omie);

    const syncRecord = await prisma.erpSyncRecord.upsert({
      where: {
        companyId_provider_environment_entityType_internalId: {
          companyId: input.companyId,
          provider: ErpProvider.OMIE,
          environment: input.environment,
          entityType:
            draft.direction === FinancialDirection.CONTA_PAGAR
              ? ErpSyncEntityType.ACCOUNT_PAYABLE
              : ErpSyncEntityType.ACCOUNT_RECEIVABLE,
          internalId: draft.id
        }
      },
      update: {
        connectionId: connection.id,
        draftId: draft.id,
        externalId,
        status: ErpSyncStatus.SUCCESS,
        requestPayload: toNullablePrismaJson(payload),
        responsePayload: toNullablePrismaJson(response),
        errorMessage: null,
        syncedAt: new Date()
      },
      create: {
        companyId: input.companyId,
        connectionId: connection.id,
        provider: ErpProvider.OMIE,
        environment: input.environment,
        entityType:
          draft.direction === FinancialDirection.CONTA_PAGAR
            ? ErpSyncEntityType.ACCOUNT_PAYABLE
            : ErpSyncEntityType.ACCOUNT_RECEIVABLE,
        internalId: draft.id,
        draftId: draft.id,
        externalId,
        status: ErpSyncStatus.SUCCESS,
        requestPayload: toNullablePrismaJson(payload),
        responsePayload: toNullablePrismaJson(response),
        syncedAt: new Date()
      }
    });

    await touchOmieLastSync(connection.id);

    return {
      draftId: draft.id,
      environment: input.environment,
      status: syncRecord.status,
      externalId: syncRecord.externalId,
      response
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OMIE export failed";
    await prisma.erpSyncRecord.upsert({
      where: {
        companyId_provider_environment_entityType_internalId: {
          companyId: input.companyId,
          provider: ErpProvider.OMIE,
          environment: input.environment,
          entityType:
            draft.direction === FinancialDirection.CONTA_PAGAR
              ? ErpSyncEntityType.ACCOUNT_PAYABLE
              : ErpSyncEntityType.ACCOUNT_RECEIVABLE,
          internalId: draft.id
        }
      },
      update: {
        connectionId: connection.id,
        draftId: draft.id,
        status: ErpSyncStatus.ERROR,
        errorMessage: message,
        syncedAt: null
      },
      create: {
        companyId: input.companyId,
        connectionId: connection.id,
        provider: ErpProvider.OMIE,
        environment: input.environment,
        entityType:
          draft.direction === FinancialDirection.CONTA_PAGAR
            ? ErpSyncEntityType.ACCOUNT_PAYABLE
            : ErpSyncEntityType.ACCOUNT_RECEIVABLE,
        internalId: draft.id,
        draftId: draft.id,
        status: ErpSyncStatus.ERROR,
        errorMessage: message
      }
    });
    throw error;
  }
}
