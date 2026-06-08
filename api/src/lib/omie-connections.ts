import { ErpEnvironment, ErpHealthStatus, ErpProvider } from "@prisma/client";
import { env } from "../config/env.js";
import { decryptOmieSecret, encryptOmieSecret } from "./omie-crypto.js";
import { prisma } from "./prisma.js";
import type { OmieConnectionSummary, OmieResolvedConnection } from "./omie-types.js";

const DEFAULT_OMIE_BASE_URL = "https://app.omie.com.br/api/v1";

function getEnvDefaults(environment: ErpEnvironment) {
  if (environment === ErpEnvironment.HOMOLOG) {
    return {
      appKey: env.OMIE_DEFAULT_HOMOLOG_APP_KEY,
      appSecret: env.OMIE_DEFAULT_HOMOLOG_APP_SECRET,
      baseUrl: env.OMIE_DEFAULT_HOMOLOG_BASE_URL ?? DEFAULT_OMIE_BASE_URL
    };
  }

  return {
    appKey: env.OMIE_DEFAULT_PROD_APP_KEY,
    appSecret: env.OMIE_DEFAULT_PROD_APP_SECRET,
    baseUrl: env.OMIE_DEFAULT_PROD_BASE_URL ?? DEFAULT_OMIE_BASE_URL
  };
}

function hasEnvDefaults(environment: ErpEnvironment) {
  const values = getEnvDefaults(environment);
  return Boolean(values.appKey && values.appSecret);
}

async function materializeEnvBackedConnection(companyId: string, environment: ErpEnvironment) {
  const defaults = getEnvDefaults(environment);
  if (!defaults.appKey || !defaults.appSecret) {
    return null;
  }

  return prisma.erpConnection.upsert({
    where: {
      companyId_provider_environment: {
        companyId,
        provider: ErpProvider.OMIE,
        environment
      }
    },
    update: {
      baseUrl: defaults.baseUrl,
      enabled: true,
      appKeyCipher: encryptOmieSecret(defaults.appKey),
      appSecretCipher: encryptOmieSecret(defaults.appSecret)
    },
    create: {
      companyId,
      provider: ErpProvider.OMIE,
      environment,
      baseUrl: defaults.baseUrl,
      enabled: true,
      appKeyCipher: encryptOmieSecret(defaults.appKey),
      appSecretCipher: encryptOmieSecret(defaults.appSecret)
    }
  });
}

export async function listOmieConnections(companyId: string): Promise<OmieConnectionSummary[]> {
  await Promise.all(
    [ErpEnvironment.HOMOLOG, ErpEnvironment.PRODUCTION]
      .filter((environment) => hasEnvDefaults(environment))
      .map((environment) => materializeEnvBackedConnection(companyId, environment))
  );

  const records = await prisma.erpConnection.findMany({
    where: {
      companyId,
      provider: ErpProvider.OMIE
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
    hasAppKey: Boolean(record.appKeyCipher),
    hasAppSecret: Boolean(record.appSecretCipher),
    lastSyncAt: record.lastSyncAt?.toISOString() ?? null,
    lastHealthcheckAt: record.lastHealthcheckAt?.toISOString() ?? null,
    lastHealthcheckStatus: record.lastHealthcheckStatus,
    lastError: record.lastError
  }));
}

export async function saveOmieConnection(input: {
  companyId: string;
  environment: ErpEnvironment;
  appKey?: string | null;
  appSecret?: string | null;
  baseUrl?: string | null;
  enabled: boolean;
}) {
  const existing = await prisma.erpConnection.findUnique({
    where: {
      companyId_provider_environment: {
        companyId: input.companyId,
        provider: ErpProvider.OMIE,
        environment: input.environment
      }
    }
  });

  const defaults = getEnvDefaults(input.environment);
  const nextBaseUrl = input.baseUrl?.trim() || existing?.baseUrl || defaults.baseUrl || DEFAULT_OMIE_BASE_URL;

  return prisma.erpConnection.upsert({
    where: {
      companyId_provider_environment: {
        companyId: input.companyId,
        provider: ErpProvider.OMIE,
        environment: input.environment
      }
    },
    update: {
      baseUrl: nextBaseUrl,
      enabled: input.enabled,
      appKeyCipher:
        input.appKey && input.appKey.trim().length
          ? encryptOmieSecret(input.appKey.trim())
          : existing?.appKeyCipher,
      appSecretCipher:
        input.appSecret && input.appSecret.trim().length
          ? encryptOmieSecret(input.appSecret.trim())
          : existing?.appSecretCipher
    },
    create: {
      companyId: input.companyId,
      provider: ErpProvider.OMIE,
      environment: input.environment,
      baseUrl: nextBaseUrl,
      enabled: input.enabled,
      appKeyCipher: input.appKey?.trim().length ? encryptOmieSecret(input.appKey.trim()) : null,
      appSecretCipher: input.appSecret?.trim().length ? encryptOmieSecret(input.appSecret.trim()) : null
    }
  });
}

export async function resolveOmieConnection(companyId: string, environment: ErpEnvironment): Promise<OmieResolvedConnection> {
  let connection = await prisma.erpConnection.findUnique({
    where: {
      companyId_provider_environment: {
        companyId,
        provider: ErpProvider.OMIE,
        environment
      }
    }
  });

  if (!connection && hasEnvDefaults(environment)) {
    connection = await materializeEnvBackedConnection(companyId, environment);
  }

  if (!connection) {
    throw new Error(`OMIE connection for ${environment} not configured`);
  }

  const defaults = getEnvDefaults(environment);
  const appKey = connection.appKeyCipher ? decryptOmieSecret(connection.appKeyCipher) : defaults.appKey;
  const appSecret = connection.appSecretCipher ? decryptOmieSecret(connection.appSecretCipher) : defaults.appSecret;
  if (!appKey || !appSecret) {
    throw new Error(`OMIE credentials for ${environment} are incomplete`);
  }

  return {
    ...connection,
    appKey,
    appSecret
  };
}

export async function markOmieConnectionHealth(input: {
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

export async function touchOmieLastSync(connectionId: string) {
  return prisma.erpConnection.update({
    where: { id: connectionId },
    data: {
      lastSyncAt: new Date(),
      lastError: null
    }
  });
}
