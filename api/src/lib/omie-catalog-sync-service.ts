import { ErpEnvironment, ErpProvider, ErpSyncEntityType, ErpSyncStatus } from "@prisma/client";
import { OmieClient } from "./omie-client.js";
import { resolveOmieConnection, touchOmieLastSync } from "./omie-connections.js";
import { extractOmieLabel, normalizeOmieLookupLabel } from "./omie-mapper.js";
import { prisma } from "./prisma.js";
import { toNullablePrismaJson } from "./prisma-json.js";
import type { OmieCatalogSyncResult } from "./omie-types.js";
import { normalizeBrazilianDocument, reconcileCompanyClientDocuments, upsertClientIdentity } from "./client-identity.js";

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

function looksLikeSupplier(payload: Record<string, unknown>) {
  const typeCandidate = payload.tipo_cliente_fornecedor ?? payload.tipo_pessoa ?? payload.inativo;
  if (typeof typeCandidate === "string") {
    const normalized = typeCandidate.trim().toUpperCase();
    if (normalized.includes("FORNEC")) {
      return true;
    }
    if (normalized.includes("CLIENT")) {
      return false;
    }
  }

  const supplierCode = payload.codigo_cliente_fornecedor;
  const clientCode = payload.codigo_cliente_omie;
  if (supplierCode != null && clientCode == null) {
    return true;
  }

  return false;
}

async function ensureLocalClient(input: {
  localClients: Array<{
    id: string;
    name: string;
    document: string | null;
  }>;
  companyId: string;
  payload: Record<string, unknown>;
  name: string;
}) {
  const created = await upsertClientIdentity(prisma, {
    companyId: input.companyId,
    name: input.name,
    document: extractDocument(input.payload),
    segment: "OMIE sync",
    status: "Ativo",
    sinceYear: new Date().getUTCFullYear()
  });

  const tracked = input.localClients.find((item) => item.id === created.id);
  if (tracked) {
    tracked.name = created.name;
    tracked.document = created.document;
  } else {
    input.localClients.push({
      id: created.id,
      name: created.name,
      document: created.document
    });
  }
  return created;
}

async function ensureLocalSupplier(input: {
  localSuppliers: Array<{
    id: string;
    name: string;
    cnpj: string | null;
    category: string;
  }>;
  companyId: string;
  payload: Record<string, unknown>;
  name: string;
}) {
  const document = extractDocument(input.payload);
  const normalizedName = normalizeOmieLookupLabel(input.name);
  const normalizedDocument = normalizeOmieLookupLabel(document);

  const existing = input.localSuppliers.find(
    (item) =>
      normalizeOmieLookupLabel(item.name) === normalizedName ||
      (normalizedDocument.length > 0 && normalizeOmieLookupLabel(item.cnpj) === normalizedDocument)
  );

  if (existing) {
    const nextCategory = existing.category?.trim().length ? existing.category : "OMIE sync";
    if (existing.name !== input.name || existing.cnpj !== (document ?? null) || existing.category !== nextCategory) {
      const updated = await prisma.supplier.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          cnpj: document ?? null,
          category: nextCategory
        }
      });
      existing.name = updated.name;
      existing.cnpj = updated.cnpj;
      existing.category = updated.category;
      return updated;
    }
    return existing;
  }

  const created = await prisma.supplier.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      cnpj: document ?? null,
      category: "OMIE sync",
      yearlySpend: 0,
      lastTransaction: "sincronizado"
    }
  });
  input.localSuppliers.push(created);
  return created;
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
      prisma.client.findMany({ where: { companyId: input.companyId }, select: { id: true, name: true, document: true } }),
      prisma.supplier.findMany({ where: { companyId: input.companyId }, select: { id: true, name: true, cnpj: true, category: true } }),
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

    const supplierOnly = looksLikeSupplier(record);

    if (!supplierOnly) {
      const localClient = await ensureLocalClient({
        localClients,
        companyId: input.companyId,
        payload: record,
        name: label
      });
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

    const normalizedDocument = normalizeBrazilianDocument(extractDocument(record));
    const shouldCreateSupplier =
      supplierOnly || record.codigo_cliente_fornecedor != null || (record.codigo_cliente_integracao == null && Boolean(normalizedDocument));
    if (shouldCreateSupplier) {
      const localSupplier = await ensureLocalSupplier({
        localSuppliers,
        companyId: input.companyId,
        payload: record,
        name: label
      });
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

  await reconcileCompanyClientDocuments(prisma, input.companyId);
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
