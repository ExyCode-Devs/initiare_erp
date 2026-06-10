import { ErpEnvironment, ErpProvider, ErpSyncEntityType, ErpSyncStatus } from "@prisma/client";
import { OmieClient } from "./omie-client.js";
import { resolveOmieConnection, touchOmieLastSync } from "./omie-connections.js";
import { extractOmieLabel, normalizeOmieLookupLabel } from "./omie-mapper.js";
import { prisma } from "./prisma.js";
import { toNullablePrismaJson } from "./prisma-json.js";
import type { OmieCatalogSyncResult } from "./omie-types.js";

function extractExternalId(payload: Record<string, unknown>) {
  const candidates = [
    payload.codigo_cliente_omie,
    payload.codigo_cliente_fornecedor,
    payload.codigo,
    payload.cCodigo,
    payload.nCodCC,
    payload.id_conta_corrente
  ];
  const value = candidates.find((item) => item != null);
  return value == null ? null : String(value);
}

function extractDocument(payload: Record<string, unknown>) {
  const value = payload.cnpj_cpf ?? payload.cnpj ?? payload.cpf;
  return value == null ? null : String(value);
}

async function upsertSyncRecord(input: {
  companyId: string;
  connectionId: string;
  environment: ErpEnvironment;
  entityType: ErpSyncEntityType;
  internalId: string;
  externalId: string;
  payload: Record<string, unknown>;
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
      externalId: input.externalId,
      status: ErpSyncStatus.SUCCESS,
      requestPayload: toNullablePrismaJson({ label: extractOmieLabel(input.payload), document: extractDocument(input.payload) }),
      responsePayload: toNullablePrismaJson(input.payload),
      errorMessage: null,
      syncedAt: new Date()
    },
    create: {
      companyId: input.companyId,
      connectionId: input.connectionId,
      provider: ErpProvider.OMIE,
      environment: input.environment,
      entityType: input.entityType,
      internalId: input.internalId,
      externalId: input.externalId,
      status: ErpSyncStatus.SUCCESS,
      requestPayload: toNullablePrismaJson({ label: extractOmieLabel(input.payload), document: extractDocument(input.payload) }),
      responsePayload: toNullablePrismaJson(input.payload),
      syncedAt: new Date()
    }
  });
}

export async function syncOmieCatalogs(input: {
  companyId: string;
  legalEntityId: string;
  environment: ErpEnvironment;
  triggeredByUserId: string;
}): Promise<OmieCatalogSyncResult> {
  const connection = await resolveOmieConnection(input.companyId, input.legalEntityId, input.environment);
  const client = new OmieClient(connection);
  const context = {
    companyId: input.companyId,
    connectionId: connection.id,
    triggeredByUserId: input.triggeredByUserId
  };

  const [localClients, localSuppliers, localCategories, omieClients, omieCategories, omieCurrentAccounts] =
    await Promise.all([
      prisma.client.findMany({ where: { companyId: input.companyId } }),
      prisma.supplier.findMany({ where: { companyId: input.companyId } }),
      prisma.expenseCategory.findMany({ where: { companyId: input.companyId } }),
      client.listClients(context),
      client.listCategories(context),
      client.listCurrentAccounts(context)
    ]);

  let clientCount = 0;
  let supplierCount = 0;
  let categoryCount = 0;
  let currentAccountCount = 0;

  for (const payload of omieClients.clientes_cadastro ?? []) {
    const record = payload as Record<string, unknown>;
    const externalId = extractExternalId(record);
    const label = extractOmieLabel(record);
    if (!externalId || !label) {
      continue;
    }

    const normalizedLabel = normalizeOmieLookupLabel(label);
    const document = normalizeOmieLookupLabel(extractDocument(record));

    const localClient = localClients.find((item) => normalizeOmieLookupLabel(item.name) === normalizedLabel);
    if (localClient) {
      await upsertSyncRecord({
        companyId: input.companyId,
        connectionId: connection.id,
        environment: input.environment,
        entityType: ErpSyncEntityType.CLIENT,
        internalId: localClient.id,
        externalId,
        payload: record
      });
      clientCount += 1;
    }

    const localSupplier = localSuppliers.find(
      (item) =>
        normalizeOmieLookupLabel(item.name) === normalizedLabel ||
        (document.length > 0 && normalizeOmieLookupLabel(item.cnpj) === document)
    );
    if (localSupplier) {
      await upsertSyncRecord({
        companyId: input.companyId,
        connectionId: connection.id,
        environment: input.environment,
        entityType: ErpSyncEntityType.SUPPLIER,
        internalId: localSupplier.id,
        externalId,
        payload: record
      });
      supplierCount += 1;
    }
  }

  for (const payload of omieCategories.categoria_cadastro ?? []) {
    const record = payload as Record<string, unknown>;
    const externalId = extractExternalId(record);
    const label = extractOmieLabel(record);
    if (!externalId || !label) {
      continue;
    }

    const localCategory = localCategories.find((item) => normalizeOmieLookupLabel(item.name) === normalizeOmieLookupLabel(label));
    await upsertSyncRecord({
      companyId: input.companyId,
      connectionId: connection.id,
      environment: input.environment,
      entityType: ErpSyncEntityType.CATEGORY,
      internalId: localCategory?.id ?? `category:${externalId}`,
      externalId,
      payload: record
    });
    categoryCount += 1;
  }

  for (const payload of omieCurrentAccounts.conta_corrente_cadastro ?? []) {
    const record = payload as Record<string, unknown>;
    const externalId = extractExternalId(record);
    if (!externalId) {
      continue;
    }

    await upsertSyncRecord({
      companyId: input.companyId,
      connectionId: connection.id,
      environment: input.environment,
      entityType: ErpSyncEntityType.CURRENT_ACCOUNT,
      internalId: `current-account:${externalId}`,
      externalId,
      payload: record
    });
    currentAccountCount += 1;
  }

  await touchOmieLastSync(connection.id);

  return {
    environment: input.environment,
    syncedAt: new Date().toISOString(),
    counts: {
      clients: clientCount,
      suppliers: supplierCount,
      categories: categoryCount,
      currentAccounts: currentAccountCount
    }
  };
}
