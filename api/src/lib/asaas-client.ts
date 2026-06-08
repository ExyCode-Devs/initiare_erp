import { ErpOperationStatus } from "@prisma/client";
import { recordAsaasRequestLog } from "./asaas-audit-service.js";
import type { AsaasResolvedConnection } from "./asaas-types.js";

type AsaasRequestContext = {
  companyId: string;
  connectionId: string;
  triggeredByUserId?: string | null;
};

type AsaasListResponse<T> = {
  data?: T[];
  totalCount?: number;
  hasMore?: boolean;
  errors?: Array<{ code?: string; description?: string }>;
  [key: string]: unknown;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function buildEndpoint(baseUrl: string, relativePath: string) {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = relativePath.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

function maskSecrets(input: unknown): unknown {
  if (input == null) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(maskSecrets);
  }

  if (typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => [
        key,
        /token|authorization|access_token/i.test(key) ? "***" : maskSecrets(value)
      ])
    );
  }

  return input;
}

function extractFriendlyError(payload: unknown) {
  if (payload && typeof payload === "object" && Array.isArray((payload as { errors?: unknown }).errors)) {
    const first = (payload as { errors: Array<{ description?: string }> }).errors[0];
    if (first?.description) {
      return first.description;
    }
  }

  return "ASAAS request failed";
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim().length) {
    return {};
  }

  return JSON.parse(text) as Record<string, unknown>;
}

export class AsaasClient {
  constructor(private readonly connection: AsaasResolvedConnection) {}

  private async request<T>(method: string, relativePath: string, context: AsaasRequestContext, body?: unknown): Promise<T> {
    const endpoint = buildEndpoint(this.connection.baseUrl, relativePath);
    const maxAttempts = 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      try {
        const response = await fetch(endpoint, {
          method,
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            access_token: this.connection.apiKey,
            "User-Agent": "initiare-erp/1.0"
          },
          body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
          signal: controller.signal
        });
        clearTimeout(timeout);

        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          const friendlyError = extractFriendlyError(payload);
          await recordAsaasRequestLog({
            companyId: context.companyId,
            connectionId: context.connectionId,
            triggeredByUserId: context.triggeredByUserId,
            method,
            endpoint,
            requestBody: body ?? null,
            responseBody: maskSecrets(payload),
            httpStatus: response.status,
            operationStatus: ErpOperationStatus.ERROR,
            friendlyError,
            technicalError: JSON.stringify(maskSecrets(payload))
          });
          const error = new Error(friendlyError);
          Object.assign(error, { responseStatus: response.status, responseBody: payload });
          throw error;
        }

        await recordAsaasRequestLog({
          companyId: context.companyId,
          connectionId: context.connectionId,
          triggeredByUserId: context.triggeredByUserId,
          method,
          endpoint,
          requestBody: body ?? null,
          responseBody: maskSecrets(payload),
          httpStatus: response.status,
          operationStatus: ErpOperationStatus.SUCCESS
        });

        return payload as T;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        const message = error instanceof Error ? error.message : "Unknown ASAAS error";
        const retryable = attempt < maxAttempts && /(timeout|fetch failed|network|ECONNRESET|abort)/i.test(message);
        if (!retryable) {
          if (!(error instanceof Error && "responseStatus" in error)) {
            await recordAsaasRequestLog({
              companyId: context.companyId,
              connectionId: context.connectionId,
              triggeredByUserId: context.triggeredByUserId,
              method,
              endpoint,
              requestBody: body ?? null,
              httpStatus: null,
              operationStatus: ErpOperationStatus.ERROR,
              friendlyError: "ASAAS communication failed",
              technicalError: message
            });
          }
          break;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("ASAAS request failed");
  }

  async listCustomers(context: AsaasRequestContext, offset = 0, limit = 100) {
    return this.request<AsaasListResponse<Record<string, unknown>>>(
      "GET",
      `customers?offset=${offset}&limit=${limit}`,
      context
    );
  }

  async listPayments(context: AsaasRequestContext, offset = 0, limit = 100) {
    return this.request<AsaasListResponse<Record<string, unknown>>>(
      "GET",
      `payments?offset=${offset}&limit=${limit}`,
      context
    );
  }

  async getPayment(id: string, context: AsaasRequestContext) {
    return this.request<Record<string, unknown>>("GET", `payments/${id}`, context);
  }
}
