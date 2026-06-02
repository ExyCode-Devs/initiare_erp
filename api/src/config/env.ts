import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  APP_ORIGIN: z.string().default("http://localhost:3000"),
  SEED_COMPANY_NAME: z.string().default("Acme Holdings"),
  SEED_COMPANY_DOMAIN: z.string().default("app.veridia.io"),
  SEED_ADMIN_EMAIL: z.email().default("admin@veridia.local"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),
  METRICS_ENABLED: z
    .union([z.literal("true"), z.literal("false")])
    .default("true")
    .transform((value) => value === "true")
});

export const env = envSchema.parse(process.env);
