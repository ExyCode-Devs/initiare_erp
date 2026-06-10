import { FinancialDirection } from "@prisma/client";

function normalizeString(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatOmieDate(value: Date) {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();

  return `${day}/${month}/${year}`;
}

export function normalizeOmieLookupLabel(value: string | null | undefined) {
  return value ? normalizeString(value) : "";
}

export function extractOmieLabel(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const candidates = [
    data.name,
    data.nome,
    data.descricao,
    data.descricao_padrao,
    data.descricao_status,
    data.conta_corrente,
    data.categoria
  ];

  const first = candidates.find((item) => typeof item === "string" && item.trim().length);
  return typeof first === "string" ? first.trim() : null;
}

export function mapOmieDraftPayload(input: {
  draft: {
    id: string;
    direction: FinancialDirection;
    amount: number;
    dueDate: Date;
    description: string;
    notes: string | null;
  };
  partyExternalId: string;
  categoryExternalId: string;
  currentAccountExternalId: string;
}) {
  const basePayload = {
    codigo_lancamento_integracao: input.draft.id,
    codigo_cliente_fornecedor: Number(input.partyExternalId),
    data_vencimento: formatOmieDate(input.draft.dueDate),
    data_previsao: formatOmieDate(input.draft.dueDate),
    valor_documento: input.draft.amount,
    codigo_categoria: input.categoryExternalId,
    id_conta_corrente: Number(input.currentAccountExternalId),
    observacao: input.draft.notes ?? input.draft.description
  };

  if (input.draft.direction === FinancialDirection.CONTA_PAGAR) {
    return basePayload;
  }

  return basePayload;
}

export function mapOmiePartyPayload(input: {
  integrationCode: string;
  name: string;
  cpfCnpj: string | null;
  email?: string | null;
}) {
  return {
    codigo_cliente_integracao: input.integrationCode,
    razao_social: input.name,
    nome_fantasia: input.name,
    cnpj_cpf: input.cpfCnpj ?? undefined,
    email: input.email ?? undefined
  };
}
