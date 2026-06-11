import { ErpEnvironment, ErpProvider, ErpSyncEntityType, ErpSyncStatus } from "@prisma/client";
import { AsaasClient } from "./asaas-client.js";
import { normalizeAsaasCustomer, normalizeAsaasPayment } from "./asaas-mapper.js";
import { prisma } from "./prisma.js";
import { toNullablePrismaJson } from "./prisma-json.js";
import { resolveAsaasConnection, touchAsaasLastSync } from "./asaas-connections.js";
import type { AsaasNormalizedCustomer, AsaasNormalizedPayment, AsaasSyncResult } from "./asaas-types.js";
import { reconcileCompanyClientDocuments, upsertClientIdentity } from "./client-identity.js";

function currentYear() {
  return new Date().getFullYear();
}

async function upsertClientFromAsaas(companyId: string, customer: AsaasNormalizedCustomer) {
  return upsertClientIdentity(prisma, {
    companyId,
    name: customer.name,
    document: customer.cpfCnpj,
    segment: "Asaas",
    status: "Sincronizado",
    sinceYear: currentYear()
  });
}

async function upsertSyncRecord(input: {
  companyId: string;
  connectionId: string;
  environment: ErpEnvironment;
  entityType: ErpSyncEntityType;
  internalId: string;
  externalId: string;
  normalized: unknown;
  payload: Record<string, unknown>;
  status?: ErpSyncStatus;
  errorMessage?: string | null;
}) {
  return prisma.erpSyncRecord.upsert({
    where: {
      companyId_provider_environment_entityType_internalId: {
        companyId: input.companyId,
        provider: ErpProvider.ASAAS,
        environment: input.environment,
        entityType: input.entityType,
        internalId: input.internalId
      }
    },
    update: {
      connectionId: input.connectionId,
      externalId: input.externalId,
      status: input.status ?? ErpSyncStatus.SUCCESS,
      requestPayload: toNullablePrismaJson(input.normalized),
      responsePayload: toNullablePrismaJson(input.payload),
      errorMessage: input.errorMessage ?? null,
      syncedAt: new Date()
    },
    create: {
      companyId: input.companyId,
      connectionId: input.connectionId,
      provider: ErpProvider.ASAAS,
      environment: input.environment,
      entityType: input.entityType,
      internalId: input.internalId,
      externalId: input.externalId,
      status: input.status ?? ErpSyncStatus.SUCCESS,
      requestPayload: toNullablePrismaJson(input.normalized),
      responsePayload: toNullablePrismaJson(input.payload),
      errorMessage: input.errorMessage ?? null,
      syncedAt: new Date()
    }
  });
}

export async function syncAsaasData(input: {
  companyId: string;
  legalEntityId: string;
  environment: ErpEnvironment;
  triggeredByUserId: string;
}): Promise<AsaasSyncResult> {
  const connection = await resolveAsaasConnection(input.companyId, input.legalEntityId, input.environment);
  const client = new AsaasClient(connection);
  const context = {
    companyId: input.companyId,
    connectionId: connection.id,
    triggeredByUserId: input.triggeredByUserId
  };

  const customerResponse = await client.listCustomers(context);
  const customers = (customerResponse.data ?? []).map((item) => normalizeAsaasCustomer(item));
  const customerMap = new Map<string, AsaasNormalizedCustomer>();

  let customersCount = 0;
  for (const normalized of customers) {
    if (!normalized.id) {
      continue;
    }

    customerMap.set(normalized.id, normalized);
    const localClient =
      normalized.name && (normalized.email || normalized.cpfCnpj || normalized.mobilePhone)
        ? await upsertClientFromAsaas(input.companyId, normalized)
        : null;

    await upsertSyncRecord({
      companyId: input.companyId,
      connectionId: connection.id,
      environment: input.environment,
      entityType: ErpSyncEntityType.CLIENT,
      internalId: localClient?.id ?? `customer:${normalized.id}`,
      externalId: normalized.id,
      normalized,
      payload: normalized as unknown as Record<string, unknown>
    });
    customersCount += 1;
  }

  const paymentsResponse = await client.listPayments(context);
  let chargesCount = 0;
  let paymentsCount = 0;
  let feesCount = 0;

  for (const payload of paymentsResponse.data ?? []) {
    const normalized = normalizeAsaasPayment(payload, customerMap.get(String(payload.customer ?? ""))?.name ?? null);
    if (!normalized.id) {
      continue;
    }

    await upsertSyncRecord({
      companyId: input.companyId,
      connectionId: connection.id,
      environment: input.environment,
      entityType: ErpSyncEntityType.CHARGE,
      internalId: `charge:${normalized.id}`,
      externalId: normalized.id,
      normalized,
      payload
    });
    chargesCount += 1;

    if (normalized.paymentDate || normalized.status.toUpperCase().includes("RECEIVED")) {
      await upsertSyncRecord({
        companyId: input.companyId,
        connectionId: connection.id,
        environment: input.environment,
        entityType: ErpSyncEntityType.PAYMENT_RECEIPT,
        internalId: `payment:${normalized.id}`,
        externalId: normalized.id,
        normalized,
        payload
      });
      paymentsCount += 1;
    }

    if (normalized.feeValue != null) {
      await upsertSyncRecord({
        companyId: input.companyId,
        connectionId: connection.id,
        environment: input.environment,
        entityType: ErpSyncEntityType.FEE,
        internalId: `fee:${normalized.id}`,
        externalId: normalized.id,
        normalized: {
          chargeId: normalized.id,
          feeValue: normalized.feeValue,
          netValue: normalized.netValue,
          grossValue: normalized.grossValue
        },
        payload
      });
      feesCount += 1;
    }
  }

  await reconcileCompanyClientDocuments(prisma, input.companyId);
  await touchAsaasLastSync(connection.id);

  return {
    environment: input.environment,
    syncedAt: new Date().toISOString(),
    counts: {
      customers: customersCount,
      charges: chargesCount,
      payments: paymentsCount,
      fees: feesCount
    }
  };
}

export async function upsertAsaasPaymentFromPayload(input: {
  companyId: string;
  connectionId: string;
  environment: ErpEnvironment;
  payload: Record<string, unknown>;
  customerName?: string | null;
}) {
  const normalized = normalizeAsaasPayment(input.payload, input.customerName ?? null);
  if (!normalized.id) {
    throw new Error("Asaas webhook payload missing payment id");
  }

  await upsertSyncRecord({
    companyId: input.companyId,
    connectionId: input.connectionId,
    environment: input.environment,
    entityType: ErpSyncEntityType.CHARGE,
    internalId: `charge:${normalized.id}`,
    externalId: normalized.id,
    normalized,
    payload: input.payload
  });

  if (normalized.paymentDate || normalized.status.toUpperCase().includes("RECEIVED")) {
    await upsertSyncRecord({
      companyId: input.companyId,
      connectionId: input.connectionId,
      environment: input.environment,
      entityType: ErpSyncEntityType.PAYMENT_RECEIPT,
      internalId: `payment:${normalized.id}`,
      externalId: normalized.id,
      normalized,
      payload: input.payload
    });
  }

  if (normalized.feeValue != null) {
    await upsertSyncRecord({
      companyId: input.companyId,
      connectionId: input.connectionId,
      environment: input.environment,
      entityType: ErpSyncEntityType.FEE,
      internalId: `fee:${normalized.id}`,
      externalId: normalized.id,
      normalized: {
        chargeId: normalized.id,
        feeValue: normalized.feeValue,
        netValue: normalized.netValue,
        grossValue: normalized.grossValue
      },
      payload: input.payload
    });
  }

  return normalized;
}

export function mapAsaasReceivableRow(input: {
  syncId: string;
  charge: AsaasNormalizedPayment;
  webhookStatus: string | null;
  webhookError: string | null;
}) {
  return {
    id: input.syncId,
    externalId: input.charge.id,
    customer: input.charge.customerName ?? "Sem cliente",
    amount: input.charge.grossValue,
    netAmount: input.charge.netValue,
    fee: input.charge.feeValue,
    dueDate: input.charge.dueDate,
    paymentDate: input.charge.paymentDate,
    status: input.charge.status,
    billingType: input.charge.billingType,
    description: input.charge.description,
    invoiceUrl: input.charge.invoiceUrl,
    source: "ASAAS",
    webhookStatus: input.webhookStatus,
    webhookError: input.webhookError
  };
}
