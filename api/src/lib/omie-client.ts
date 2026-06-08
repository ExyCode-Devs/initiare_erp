import { ErpOperationStatus } from "@prisma/client";
import { recordOmieRequestLog } from "./omie-audit-service.js";
import type { OmieResolvedConnection } from "./omie-types.js";

type OmieApiEnvelope = {
  faultcode?: string;
  faultstring?: string;
  codigo_status?: string;
  descricao_status?: string;
  [key: string]: unknown;
};

type OmieRequestContext = {
  companyId: string;
  connectionId: string;
  draftId?: string | null;
  triggeredByUserId?: string | null;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function buildEndpoint(baseUrl: string, relativePath: string) {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = relativePath.replace(/^\/+|\/+$/g, "");
  return `${normalizedBase}/${normalizedPath}/`;
}

function maskOmieSecrets(input: unknown): unknown {
  if (input == null) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(maskOmieSecrets);
  }

  if (typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]): [string, unknown] => [
        key,
        key === "app_key" || key === "app_secret" ? "***" : maskOmieSecrets(value)
      ])
    );
  }

  return input;
}

function getFriendlyError(payload: OmieApiEnvelope) {
  return (
    (typeof payload.faultstring === "string" && payload.faultstring) ||
    (typeof payload.descricao_status === "string" && payload.descricao_status) ||
    "OMIE request failed"
  );
}

function hasOmieError(payload: OmieApiEnvelope) {
  if (payload.faultcode || payload.faultstring) {
    return true;
  }

  return payload.codigo_status != null && String(payload.codigo_status) !== "0";
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim().length) {
    return {};
  }

  return JSON.parse(text) as OmieApiEnvelope;
}

export class OmieClient {
  constructor(private readonly connection: OmieResolvedConnection) {}

  private async request<T>(
    relativePath: string,
    call: string,
    params: Record<string, unknown>,
    context: OmieRequestContext
  ): Promise<T> {
    const endpoint = buildEndpoint(this.connection.baseUrl, relativePath);
    const requestBody = {
      call,
      app_key: this.connection.appKey,
      app_secret: this.connection.appSecret,
      param: [params]
    };

    const maxAttempts = 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json"
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        clearTimeout(timeout);

        const payload = await parseJsonResponse(response);
        if (!response.ok || hasOmieError(payload)) {
          const friendlyError = getFriendlyError(payload);
          await recordOmieRequestLog({
            companyId: context.companyId,
            connectionId: context.connectionId,
            draftId: context.draftId,
            triggeredByUserId: context.triggeredByUserId,
            method: "POST",
            endpoint,
            requestBody: { call, param: requestBody.param },
            responseBody: maskOmieSecrets(payload),
            httpStatus: response.status,
            operationStatus: ErpOperationStatus.ERROR,
            friendlyError,
            technicalError: JSON.stringify(maskOmieSecrets(payload))
          });

          const error = new Error(friendlyError);
          Object.assign(error, { responseStatus: response.status, responseBody: payload });
          throw error;
        }

        await recordOmieRequestLog({
          companyId: context.companyId,
          connectionId: context.connectionId,
          draftId: context.draftId,
          triggeredByUserId: context.triggeredByUserId,
          method: "POST",
          endpoint,
          requestBody: { call, param: requestBody.param },
          responseBody: maskOmieSecrets(payload),
          httpStatus: response.status,
          operationStatus: ErpOperationStatus.SUCCESS
        });

        return payload as T;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        const message = error instanceof Error ? error.message : "Unknown OMIE error";
        const retryable = attempt < maxAttempts && /(timeout|fetch failed|network|ECONNRESET|abort)/i.test(message);
        if (!retryable) {
          if (!(error instanceof Error && "responseStatus" in error)) {
            await recordOmieRequestLog({
              companyId: context.companyId,
              connectionId: context.connectionId,
              draftId: context.draftId,
              triggeredByUserId: context.triggeredByUserId,
              method: "POST",
              endpoint,
              requestBody: { call, param: requestBody.param },
              httpStatus: null,
              operationStatus: ErpOperationStatus.ERROR,
              friendlyError: "OMIE communication failed",
              technicalError: message
            });
          }
          break;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("OMIE request failed");
  }

  async listClients(context: OmieRequestContext) {
    return this.request<{ clientes_cadastro?: Array<Record<string, unknown>>; total_de_paginas?: number }>(
      "geral/clientes",
      "ListarClientes",
      {
        pagina: 1,
        registros_por_pagina: 100,
        apenas_importado_api: "N"
      },
      context
    );
  }

  async listCategories(context: OmieRequestContext) {
    return this.request<{ categoria_cadastro?: Array<Record<string, unknown>>; total_de_paginas?: number }>(
      "geral/categorias",
      "ListarCategorias",
      {
        pagina: 1,
        registros_por_pagina: 100
      },
      context
    );
  }

  async listCurrentAccounts(context: OmieRequestContext) {
    try {
      return await this.request<{ conta_corrente_cadastro?: Array<Record<string, unknown>>; total_de_paginas?: number }>(
        "geral/contacorrente",
        "ListarContasCorrentes",
        {
          pagina: 1,
          registros_por_pagina: 100
        },
        context
      );
    } catch {
      return this.request<{ conta_corrente_cadastro?: Array<Record<string, unknown>>; total_de_paginas?: number }>(
        "geral/contacorrente",
        "ListarContasCorrentes",
        {
          nPagina: 1,
          nRegPorPagina: 100
        },
        context
      );
    }
  }

  async createPayable(payload: Record<string, unknown>, context: OmieRequestContext) {
    return this.request<OmieApiEnvelope>("financas/contapagar", "IncluirContaPagar", payload, context);
  }

  async createReceivable(payload: Record<string, unknown>, context: OmieRequestContext) {
    return this.request<OmieApiEnvelope>("financas/contareceber", "IncluirContaReceber", payload, context);
  }
}
