import { ErpEnvironment, ErpProvider, ErpSyncStatus } from "@prisma/client";
import { prisma } from "./prisma.js";
import { toNullablePrismaJson } from "./prisma-json.js";
import { resolveAsaasConnection, touchAsaasLastSync } from "./asaas-connections.js";
import { AsaasClient } from "./asaas-client.js";
import { upsertAsaasPaymentFromPayload } from "./asaas-sync-service.js";
import type { AsaasWebhookResult } from "./asaas-types.js";

function pickHeader(headers: Record<string, unknown>, key: string) {
  const direct = headers[key];
  if (typeof direct === "string") {
    return direct;
  }
  const lower = headers[key.toLowerCase()];
  return typeof lower === "string" ? lower : null;
}

function inferEventId(payload: Record<string, unknown>) {
  const event = payload.event;
  const payment = payload.payment;
  const idParts = [
    typeof event === "string" ? event : "UNKNOWN_EVENT",
    payment && typeof payment === "object" && "id" in payment ? String((payment as { id?: unknown }).id ?? "unknown") : "unknown",
    payload.id != null ? String(payload.id) : "no-id"
  ];
  return idParts.join(":");
}

function inferEventType(payload: Record<string, unknown>) {
  return typeof payload.event === "string" ? payload.event : "UNKNOWN_EVENT";
}

export async function processAsaasWebhook(input: {
  companyId: string;
  environment: ErpEnvironment;
  headers: Record<string, unknown>;
  payload: Record<string, unknown>;
}): Promise<AsaasWebhookResult> {
  const connection = await resolveAsaasConnection(input.companyId, input.environment);
  const receivedToken = pickHeader(input.headers, "asaas-access-token");
  if (!connection.webhookAuthToken || receivedToken !== connection.webhookAuthToken) {
    throw new Error("Invalid ASAAS webhook token");
  }

  const externalEventId = inferEventId(input.payload);
  const eventType = inferEventType(input.payload);

  const event = await prisma.erpWebhookEvent.upsert({
    where: {
      companyId_provider_environment_externalEventId: {
        companyId: input.companyId,
        provider: ErpProvider.ASAAS,
        environment: input.environment,
        externalEventId
      }
    },
    update: {},
    create: {
      companyId: input.companyId,
      provider: ErpProvider.ASAAS,
      environment: input.environment,
      externalEventId,
      eventType,
      headers: toNullablePrismaJson(input.headers),
      payload: toNullablePrismaJson(input.payload),
      connectionId: connection.id
    }
  });

  if (event.status === ErpSyncStatus.SUCCESS) {
    return {
      accepted: true,
      eventId: externalEventId,
      eventType,
      status: event.status
    };
  }

  try {
    let paymentPayload =
      input.payload.payment && typeof input.payload.payment === "object"
        ? (input.payload.payment as Record<string, unknown>)
        : null;

    if (!paymentPayload) {
      const paymentId = typeof input.payload.paymentId === "string" ? input.payload.paymentId : null;
      if (paymentId) {
        const client = new AsaasClient(connection);
        paymentPayload = await client.getPayment(paymentId, {
          companyId: input.companyId,
          connectionId: connection.id
        });
      }
    }

    if (paymentPayload) {
      await upsertAsaasPaymentFromPayload({
        companyId: input.companyId,
        connectionId: connection.id,
        environment: input.environment,
        payload: paymentPayload
      });
      await touchAsaasLastSync(connection.id);
    }

    await prisma.erpWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: ErpSyncStatus.SUCCESS,
        errorMessage: null,
        processedAt: new Date()
      }
    });

    return {
      accepted: true,
      eventId: externalEventId,
      eventType,
      status: ErpSyncStatus.SUCCESS
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ASAAS webhook processing failed";
    await prisma.erpWebhookEvent.update({
      where: { id: event.id },
      data: {
        status: ErpSyncStatus.ERROR,
        errorMessage: message,
        processedAt: new Date()
      }
    });
    throw error;
  }
}
