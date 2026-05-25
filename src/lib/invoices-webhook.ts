import { z } from "zod";
import type { ContaAPagar } from "../types/contas";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const store = new Map<string, ContaAPagar>();

let webhookStats = {
  received: 0,
  created: 0,
  updated: 0,
  rejected: 0,
  lastReceivedAt: null as string | null,
};

const InvoicePayloadSchema = z.object({
  id: z.coerce.string().trim().min(1),
  fornecedor: z.coerce.string().trim().min(1).optional(),
  fornecedo: z.coerce.string().trim().min(1).optional(),
  valor: z.coerce.number().finite(),
  vencimento: z.coerce.string().trim().min(1).optional().nullable(),
  dataRecebimento: z.coerce.string().trim().min(1).optional().nullable(),
  categoria: z.coerce.string().trim().min(1).optional(),
  status: z.coerce.string().trim().min(1).optional(),
  confianca: z.coerce.number().finite().min(0).max(100).optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function parseToIsoDate(dateInput: string): string | null {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeStatus(status: string | undefined): ContaAPagar["status"] {
  const key = (status ?? "").trim().toLowerCase();

  const mapped: Record<string, ContaAPagar["status"]> = {
    processado: "Processado",
    "em revisão": "Em revisão",
    "em revisao": "Em revisão",
    revisao: "Em revisão",
    revisão: "Em revisão",
    excecao: "Exceção",
    exceção: "Exceção",
    conciliado: "Conciliado",
    pendente: "Pendente",
    risco: "Em revisão",
  };

  return mapped[key] ?? "Pendente";
}

function toContaAPagar(raw: unknown): { ok: true; data: ContaAPagar } | { ok: false; reason: string } {
  if (Array.isArray(raw)) {
    return { ok: false, reason: "Expected a single invoice object, received array." };
  }

  const parsed = InvoicePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const reason = parsed.error.issues[0]?.message ?? "Invalid invoice payload.";
    return { ok: false, reason };
  }

  const fornecedor = parsed.data.fornecedor ?? parsed.data.fornecedo;
  if (!fornecedor) {
    return { ok: false, reason: "Missing fornecedor." };
  }

  const vencimentoInput = parsed.data.vencimento ?? parsed.data.dataRecebimento;
  const vencimento = vencimentoInput ? parseToIsoDate(vencimentoInput) : new Date().toISOString();
  if (!vencimento) {
    return { ok: false, reason: "Invalid vencimento date." };
  }

  return {
    ok: true,
    data: {
      id: parsed.data.id,
      fornecedor,
      valor: Math.abs(parsed.data.valor),
      vencimento,
      categoria: parsed.data.categoria ?? "Sem categoria",
      status: normalizeStatus(parsed.data.status),
      confianca: parsed.data.confianca ?? 0,
    },
  };
}

export async function handleInvoicesWebhook(request: Request): Promise<Response> {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const diagnosticsRequested = url.searchParams.get("diagnostics") === "1";

    if (diagnosticsRequested) {
      return json({ ok: true, stats: webhookStats, itemsInStore: store.size });
    }

    const arr = Array.from(store.values()).sort(
      (a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime(),
    );
    return json(arr);
  }

  if (request.method === "POST") {
    webhookStats.received += 1;
    webhookStats.lastReceivedAt = new Date().toISOString();

    try {
      const body = await request.json();
      const normalized = toContaAPagar(body);

      if (!normalized.ok) {
        webhookStats.rejected += 1;
        return json({ ok: false, error: normalized.reason }, 400);
      }

      const existed = store.has(normalized.data.id);
      store.set(normalized.data.id, normalized.data);

      if (existed) webhookStats.updated += 1;
      else webhookStats.created += 1;

      return json({
        ok: true,
        mode: existed ? "updated" : "created",
        id: normalized.data.id,
        total: store.size,
      });
    } catch (error) {
      webhookStats.rejected += 1;
      console.error("[webhook:invoices:post] failed", error);
      return json({ ok: false, error: "Invalid JSON payload." }, 400);
    }
  }

  return json({ ok: false, error: "Method not allowed." }, 405);
}

