import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const optionalString = () => z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalEmail = () => z.preprocess(emptyToUndefined, z.email().optional());
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToUndefined, z.enum(values).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  APP_ORIGIN: z.string().default("http://localhost:3000"),
  ACTIVE_ACTIONS_HMAC_SECRET: z.string().min(32, "ACTIVE_ACTIONS_HMAC_SECRET must be at least 32 chars"),
  ACTIVE_ACTIONS_MAX_SKEW_MS: z.coerce.number().int().positive().default(300000),
  API_PUBLIC_BASE_URL: optionalString(),
  ACTIVEPIECES_EXTRACTION_WEBHOOK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  ACTIVEPIECES_EXTRACTION_DELIVERY_MODE: optionalEnum(["sync", "async"]),
  ACTIVEPIECES_EXTRACTION_AUTH_MODE: optionalEnum(["bearer", "hmac", "none"]),
  ACTIVEPIECES_EXTRACTION_BEARER_TOKEN: optionalString(),
  ACTIVEPIECES_EXTRACTION_HMAC_SECRET: optionalString(),
  ACTIVEPIECES_EXTRACTION_HMAC_HEADER: optionalString(),
  ACTIVEPIECES_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  N8N_EXTRACTION_WEBHOOK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  N8N_EXTRACTION_DELIVERY_MODE: optionalEnum(["sync", "async"]).default("sync"),
  N8N_EXTRACTION_AUTH_MODE: optionalEnum(["bearer", "hmac", "none"]),
  N8N_EXTRACTION_BEARER_TOKEN: optionalString(),
  N8N_EXTRACTION_HMAC_SECRET: optionalString(),
  N8N_EXTRACTION_HMAC_HEADER: z.string().default("x-initi-signature"),
  N8N_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  MAILBOX_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
  OMIE_CONNECTION_CIPHER_KEY: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
  OMIE_DEFAULT_HOMOLOG_APP_KEY: optionalString(),
  OMIE_DEFAULT_HOMOLOG_APP_SECRET: optionalString(),
  OMIE_DEFAULT_HOMOLOG_BASE_URL: optionalString(),
  OMIE_DEFAULT_PROD_APP_KEY: optionalString(),
  OMIE_DEFAULT_PROD_APP_SECRET: optionalString(),
  OMIE_DEFAULT_PROD_BASE_URL: optionalString(),
  ASAAS_CONNECTION_CIPHER_KEY: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
  ASAAS_DEFAULT_SANDBOX_API_KEY: optionalString(),
  ASAAS_DEFAULT_SANDBOX_BASE_URL: optionalString(),
  ASAAS_DEFAULT_SANDBOX_WEBHOOK_TOKEN: optionalString(),
  ASAAS_DEFAULT_PROD_API_KEY: optionalString(),
  ASAAS_DEFAULT_PROD_BASE_URL: optionalString(),
  ASAAS_DEFAULT_PROD_WEBHOOK_TOKEN: optionalString(),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60000),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(10),
  INGESTION_STORAGE_ROOT: z.string().default("./data/financial-ingestion"),
  MAX_ATTACHMENT_SIZE_MB: z.coerce.number().int().positive().default(15),
  SEED_COMPANY_NAME: z.string().default("Initiare ERP"),
  SEED_COMPANY_DOMAIN: z.string().default("localhost:8080"),
  SEED_ADMIN_EMAIL: z.email().default("delson@initiare.com.br"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),
  SEED_ANALYST_EMAIL: optionalEmail(),
  SEED_ANALYST_PASSWORD: optionalString(),
  SEED_VIEWER_EMAIL: optionalEmail(),
  SEED_VIEWER_PASSWORD: optionalString(),
  METRICS_ENABLED: z
    .union([z.literal("true"), z.literal("false")])
    .default("true")
    .transform((value) => value === "true")
});

export const env = envSchema.parse(process.env);
