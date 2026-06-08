import { ErpEnvironment, ErpHealthStatus, ErpProvider } from "@prisma/client";
import { env } from "../config/env.js";
import { decryptAsaasSecret, encryptAsaasSecret } from "./asaas-crypto.js";
import { prisma } from "./prisma.js";
import type { AsaasConnectionSummary, AsaasResolvedConnection } from "./asaas-types.js";

const DEFAULT_SANDBOX_BASE_URL = "https://api-sandbox.asaas.com/v3";
const DEFAULT_PRODUCTION_BASE_URL = "https://api.asaas.com/v3";

function getEnvDefaults(environment: ErpEnvironment) {
  if (environment === ErpEnvironment.SANDBOX) {
    return {
      apiKey: env.ASAAS_DEFAULT_SANDBOX_API_KEY,
      baseUrl: env.ASAAS_DEFAULT_SANDBOX_BASE_URL ?? DEFAULT_SANDBOX_BASE_URL,
      webhookAuthToken: env.ASAAS_DEFAULT_SANDBOX_WEBHOOK_TOKEN ?? null
    };
  }

  return {
    apiKey: env.ASAAS_DEFAULT_PROD_API_KEY,
    baseUrl: env.ASAAS_DEFAULT_PROD_BASE_URL ?? DEFAULT_PRODUCTION_BASE_URL,
    webhookAuthToken: env.ASAAS_DEFAULT_PROD_WEBHOOK_TOKEN ?? null
  };
}

function hasEnvDefaults(environment: ErpEnvironment) {
  const values = getEnvDefaults(environment);
  return Boolean(values.apiKey);
}

async function materializeEnvBackedConnection(companyId: string, environment: ErpEnvironment) {
  const defaults = getEnvDefaults(environment);
  if (!defaults.apiKey) {
    return null;
  }

  return prisma.erpConnection.upsert({
    where: {
      companyId_provider_environment: {
        companyId,
        provider: ErpProvider.ASAAS,
        environment
      }
    },
    update: {
      baseUrl: defaults.baseUrl,
      enabled: true,
      appKeyCipher: encryptAsaasSecret(defaults.apiKey),
      webhookAuthTokenCipher: defaults.webhookAuthToken ? encryptAsaasSecret(defaults.webhookAuthToken) : null
    },
    create: {
      companyId,
      provider: ErpProvider.ASAAS,
      environment,
      baseUrl: defaults.baseUrl,
      enabled: true,
      appKeyCipher: encryptAsaasSecret(defaults.apiKey),
      webhookAuthTokenCipher: defaults.webhookAuthToken ? encryptAsaasSecret(defaults.webhookAuthToken) : null
    }
  });
}

export async function listAsaasConnections(companyId: string): Promise<AsaasConnectionSummary[]> {
  await Promise.all(
    [ErpEnvironment.SANDBOX, ErpEnvironment.PRODUCTION]
      .filter((environment) => hasEnvDefaults(environment))
      .map((environment) => materializeEnvBackedConnection(companyId, environment))
  );

  const records = await prisma.erpConnection.findMany({
    where: {
      companyId,
      provider: ErpProvider.ASAAS
    },
    orderBy: {
      environment: "asc"
    }
  });

  return records.map((record) => ({
    id: record.id,
    provider: record.provider,
    environment: record.environment,
    baseUrl: record.baseUrl,
    enabled: record.enabled,
    hasApiKey: Boolean(record.appKeyCipher),
    hasWebhookToken: Boolean(record.webhookAuthTokenCipher),
    lastSyncAt: record.lastSyncAt?.toISOString() ?? null,
    lastHealthcheckAt: record.lastHealthcheckAt?.toISOString() ?? null,
    lastHealthcheckStatus: record.lastHealthcheckStatus,
    lastError: record.lastError
  }));
}

export async function saveAsaasConnection(input: {
  companyId: string;
  environment: ErpEnvironment;
  apiKey?: string | null;
  webhookAuthToken?: string | null;
  baseUrl?: string | null;
  enabled: boolean;
}) {
  const existing = await prisma.erpConnection.findUnique({
    where: {
      companyId_provider_environment: {
        companyId: input.companyId,
        provider: ErpProvider.ASAAS,
        environment: input.environment
      }
    }
  });

  const defaults = getEnvDefaults(input.environment);
  const fallbackBaseUrl =
    input.environment === ErpEnvironment.SANDBOX ? DEFAULT_SANDBOX_BASE_URL : DEFAULT_PRODUCTION_BASE_URL;
  const nextBaseUrl = input.baseUrl?.trim() || existing?.baseUrl || defaults.baseUrl || fallbackBaseUrl;

  return prisma.erpConnection.upsert({
    where: {
      companyId_provider_environment: {
        companyId: input.companyId,
        provider: ErpProvider.ASAAS,
        environment: input.environment
      }
    },
    update: {
      baseUrl: nextBaseUrl,
      enabled: input.enabled,
      appKeyCipher:
        input.apiKey && input.apiKey.trim().length ? encryptAsaasSecret(input.apiKey.trim()) : existing?.appKeyCipher,
      webhookAuthTokenCipher:
        input.webhookAuthToken && input.webhookAuthToken.trim().length
          ? encryptAsaasSecret(input.webhookAuthToken.trim())
          : existing?.webhookAuthTokenCipher
    },
    create: {
      companyId: input.companyId,
      provider: ErpProvider.ASAAS,
      environment: input.environment,
      baseUrl: nextBaseUrl,
      enabled: input.enabled,
      appKeyCipher: input.apiKey?.trim().length ? encryptAsaasSecret(input.apiKey.trim()) : null,
      webhookAuthTokenCipher:
        input.webhookAuthToken?.trim().length ? encryptAsaasSecret(input.webhookAuthToken.trim()) : null
    }
  });
}

export async function resolveAsaasConnection(
  companyId: string,
  environment: ErpEnvironment
): Promise<AsaasResolvedConnection> {
  let connection = await prisma.erpConnection.findUnique({
    where: {
      companyId_provider_environment: {
        companyId,
        provider: ErpProvider.ASAAS,
        environment
      }
    }
  });

  if (!connection && hasEnvDefaults(environment)) {
    connection = await materializeEnvBackedConnection(companyId, environment);
  }

  if (!connection) {
    throw new Error(`ASAAS connection for ${environment} not configured`);
  }

  const defaults = getEnvDefaults(environment);
  const apiKey = connection.appKeyCipher ? decryptAsaasSecret(connection.appKeyCipher) : defaults.apiKey;
  const webhookAuthToken = connection.webhookAuthTokenCipher
    ? decryptAsaasSecret(connection.webhookAuthTokenCipher)
    : defaults.webhookAuthToken;

  if (!apiKey) {
    throw new Error(`ASAAS credentials for ${environment} are incomplete`);
  }

  return {
    ...connection,
    apiKey,
    webhookAuthToken
  };
}

export async function markAsaasConnectionHealth(input: {
  connectionId: string;
  status: ErpHealthStatus;
  error?: string | null;
}) {
  return prisma.erpConnection.update({
    where: { id: input.connectionId },
    data: {
      lastHealthcheckAt: new Date(),
      lastHealthcheckStatus: input.status,
      lastError: input.error ?? null
    }
  });
}

export async function touchAsaasLastSync(connectionId: string) {
  return prisma.erpConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: new Date(),
      lastError: null
    }
  });
}
