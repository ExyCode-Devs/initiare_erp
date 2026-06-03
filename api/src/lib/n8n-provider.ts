import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { env } from "../config/env.js";

export const n8nExtractionSchema = z.object({
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

export type N8nExtractionResult = z.infer<typeof n8nExtractionSchema>;

export type N8nRequestPayload = {
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

export async function invokeN8nExtraction(payload: N8nRequestPayload) {
  if (!env.N8N_EXTRACTION_WEBHOOK_URL || !env.N8N_EXTRACTION_BEARER_TOKEN) {
    throw new Error("n8n extraction env vars are missing");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.N8N_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(env.N8N_EXTRACTION_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.N8N_EXTRACTION_BEARER_TOKEN}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const rawText = await response.text();
    if (!response.ok) {
      throw new Error(`n8n responded with ${response.status}: ${rawText.slice(0, 400)}`);
    }

    const parsedJson = rawText ? JSON.parse(rawText) : {};
    const parsed = n8nExtractionSchema.parse(parsedJson);

    return {
      parsed,
      rawText,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("n8n returned invalid JSON");
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`n8n request timed out after ${env.N8N_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    await delay(0);
  }
}
