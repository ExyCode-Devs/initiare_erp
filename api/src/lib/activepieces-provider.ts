import { createHmac } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { env } from "../config/env.js";

export const activepiecesExtractionSchema = z.object({
  type: z.enum(["conta_pagar", "conta_receber"]),
  partyName: z.string().min(2),
  cpfCnpj: z.string().optional().nullable(),
  amount: z.coerce.number().positive().optional(),
  dueDate: z.string().optional().nullable(),
  competence: z.string().optional().nullable(),
  description: z.string().min(2),
  suggestedCategory: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  bankData: z.unknown().optional(),
  notes: z.string().optional().nullable(),
  evidence: z.array(z.string()).optional(),
  providerMeta: z.record(z.string(), z.unknown()).optional()
});

export type ActivepiecesExtractionResult = z.infer<typeof activepiecesExtractionSchema>;
type ExtractionAuthMode = "bearer" | "hmac" | "none";
type DeliveryMode = "sync" | "async";

export type ActivepiecesRequestPayload = {
  company: {
    id: string;
    name: string;
    domain: string;
  };
  email: {
    id: string;
    sender: string;
    recipients: string[];
    subject: string;
    bodyText: string;
    receivedAt: string;
  };
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    extractedText: string | null;
  }>;
  context: {
    knownSuppliers: string[];
    knownClients: string[];
    knownCategories: string[];
    hints?: string[];
  };
};

type ActivepiecesDispatchPayload = ActivepiecesRequestPayload & {
  deliveryMode: DeliveryMode;
  callback?: {
    url: string;
    extractionRunId: string;
    signatureHeader: string;
    timestampHeader: string;
  };
};

type ActivepiecesDispatchResult =
  | {
      mode: "sync";
      parsed: ActivepiecesExtractionResult;
      rawText: string;
      durationMs: number;
    }
  | {
      mode: "async";
      rawText: string | null;
      durationMs: number;
      workflowId: string | null;
    };

function getExtractionWebhookUrl() {
  return env.ACTIVEPIECES_EXTRACTION_WEBHOOK_URL ?? env.N8N_EXTRACTION_WEBHOOK_URL;
}

function getExtractionDeliveryMode(): DeliveryMode {
  return (env.ACTIVEPIECES_EXTRACTION_DELIVERY_MODE ?? env.N8N_EXTRACTION_DELIVERY_MODE ?? "sync") as DeliveryMode;
}

function getExtractionAuthMode(): ExtractionAuthMode {
  const explicit = env.ACTIVEPIECES_EXTRACTION_AUTH_MODE ?? env.N8N_EXTRACTION_AUTH_MODE;
  if (explicit) {
    return explicit as ExtractionAuthMode;
  }

  if (env.ACTIVEPIECES_EXTRACTION_BEARER_TOKEN || env.N8N_EXTRACTION_BEARER_TOKEN) {
    return "bearer";
  }

  if (env.ACTIVEPIECES_EXTRACTION_HMAC_SECRET || env.N8N_EXTRACTION_HMAC_SECRET) {
    return "hmac";
  }

  return "none";
}

function getExtractionBearerToken() {
  return env.ACTIVEPIECES_EXTRACTION_BEARER_TOKEN ?? env.N8N_EXTRACTION_BEARER_TOKEN;
}

function getExtractionHmacSecret() {
  return env.ACTIVEPIECES_EXTRACTION_HMAC_SECRET ?? env.N8N_EXTRACTION_HMAC_SECRET;
}

function getExtractionHmacHeader() {
  return env.ACTIVEPIECES_EXTRACTION_HMAC_HEADER ?? env.N8N_EXTRACTION_HMAC_HEADER;
}

function getExtractionTimeoutMs() {
  return env.ACTIVEPIECES_TIMEOUT_MS ?? env.N8N_TIMEOUT_MS;
}

function buildExtractionHeaders(rawBody: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  const authMode = getExtractionAuthMode();

  if (authMode === "bearer") {
    const bearerToken = getExtractionBearerToken();
    if (!bearerToken) {
      throw new Error("Activepieces bearer token is missing");
    }

    headers.authorization = `Bearer ${bearerToken}`;
  }

  if (authMode === "hmac") {
    const hmacSecret = getExtractionHmacSecret();
    if (!hmacSecret) {
      throw new Error("Activepieces hmac secret is missing");
    }

    headers[getExtractionHmacHeader()] = createHmac("sha256", hmacSecret).update(rawBody).digest("hex");
  }

  return headers;
}

async function invokeActivepiecesExtraction(payload: ActivepiecesRequestPayload) {
  const webhookUrl = getExtractionWebhookUrl();
  if (!webhookUrl) {
    throw new Error("Activepieces extraction webhook url is missing");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getExtractionTimeoutMs());
  const startedAt = Date.now();
  const rawBody = JSON.stringify(payload);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: buildExtractionHeaders(rawBody),
      body: rawBody,
      signal: controller.signal
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`Activepieces responded with ${response.status}: ${rawText.slice(0, 400)}`);
    }

    const parsedJson = rawText ? JSON.parse(rawText) : {};
    const parsed = activepiecesExtractionSchema.parse(parsedJson);

    return {
      parsed,
      rawText,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Activepieces returned invalid JSON");
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Activepieces request timed out after ${getExtractionTimeoutMs()}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    await delay(0);
  }
}

function resolveCallbackBaseUrl() {
  return (env.API_PUBLIC_BASE_URL ?? env.APP_ORIGIN).replace(/\/$/, "");
}

export function buildExtractionCallbackUrl() {
  return `${resolveCallbackBaseUrl()}/api/inbox/extraction-callback`;
}

export async function dispatchActivepiecesExtraction(input: {
  extractionRunId: string;
  payload: ActivepiecesRequestPayload;
}): Promise<ActivepiecesDispatchResult> {
  const deliveryMode = getExtractionDeliveryMode();
  const startedAt = Date.now();
  const requestPayload: ActivepiecesDispatchPayload =
    deliveryMode === "async"
      ? {
          ...input.payload,
          deliveryMode,
          callback: {
            url: buildExtractionCallbackUrl(),
            extractionRunId: input.extractionRunId,
            signatureHeader: "x-initi-signature",
            timestampHeader: "x-initi-timestamp"
          }
        }
      : {
          ...input.payload,
          deliveryMode
        };

  if (deliveryMode === "sync") {
    const result = await invokeActivepiecesExtraction(requestPayload);
    return {
      mode: "sync",
      ...result
    };
  }

  const webhookUrl = getExtractionWebhookUrl();
  if (!webhookUrl) {
    throw new Error("Activepieces extraction webhook url is missing");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getExtractionTimeoutMs());
  const rawBody = JSON.stringify(requestPayload);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: buildExtractionHeaders(rawBody),
      body: rawBody,
      signal: controller.signal
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`Activepieces responded with ${response.status}: ${rawText.slice(0, 400)}`);
    }

    let workflowId: string | null = null;
    if (rawText.trim().length) {
      try {
        const parsed = JSON.parse(rawText) as Record<string, unknown>;
        workflowId = typeof parsed.workflowId === "string" ? parsed.workflowId : null;
      } catch {
        workflowId = null;
      }
    }

    return {
      mode: "async",
      rawText: rawText || null,
      durationMs: Date.now() - startedAt,
      workflowId
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Activepieces request timed out after ${getExtractionTimeoutMs()}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    await delay(0);
  }
}
