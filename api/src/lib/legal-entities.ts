import { DraftRouteSource, DraftRoutingStatus, type Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeCnpj(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

function normalizeStringArray(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? normalizeText(item) : ""))
    .filter((item) => item.length > 0);
}

function entityLabel(entity: { legalName: string; tradeName: string | null }) {
  return entity.tradeName?.trim() || entity.legalName;
}

export async function ensureDefaultLegalEntity(companyId: string) {
  const existing = await prisma.legalEntity.findFirst({
    where: { companyId, isDefault: true }
  });

  if (existing) {
    return existing;
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { id: true, name: true }
  });

  return prisma.legalEntity.create({
    data: {
      companyId: company.id,
      legalName: company.name,
      tradeName: company.name,
      cnpj: `default-${company.id}`,
      isDefault: true,
      notes: "Auto-created runtime default legal entity"
    }
  });
}

export async function listLegalEntities(companyId: string) {
  await ensureDefaultLegalEntity(companyId);

  return prisma.legalEntity.findMany({
    where: { companyId },
    orderBy: [{ isDefault: "desc" }, { legalName: "asc" }]
  });
}

export async function getLegalEntityOrThrow(companyId: string, legalEntityId: string) {
  return prisma.legalEntity.findFirstOrThrow({
    where: {
      id: legalEntityId,
      companyId
    }
  });
}

export async function resolveCompanyFromDraftRoute(input: {
  targetCnpj?: string | null;
  recipient?: string | null;
  mailbox?: string | null;
}) {
  const normalizedCnpj = normalizeCnpj(input.targetCnpj);
  const normalizedRecipient = normalizeText(input.recipient);
  const normalizedMailbox = normalizeText(input.mailbox);

  const entities = await prisma.legalEntity.findMany({
    where: { active: true },
    include: {
      company: {
        select: { id: true, name: true }
      }
    }
  });

  const matchesByCnpj = normalizedCnpj
    ? entities.filter((entity) => normalizeCnpj(entity.cnpj) === normalizedCnpj)
    : [];
  if (matchesByCnpj.length === 1) {
    const match = matchesByCnpj[0];
    return {
      companyId: match.companyId,
      legalEntityId: match.id,
      legalEntityName: entityLabel(match),
      routingStatus: DraftRoutingStatus.ROUTED,
      routeSource: DraftRouteSource.CNPJ,
      routingReason: `Roteado por CNPJ ${normalizedCnpj}`
    };
  }
  if (matchesByCnpj.length > 1) {
    const companyIds = [...new Set(matchesByCnpj.map((entity) => entity.companyId))];
    return {
      companyId: companyIds.length === 1 ? companyIds[0] : null,
      legalEntityId: null,
      legalEntityName: null,
      routingStatus: DraftRoutingStatus.UNROUTED,
      routeSource: DraftRouteSource.CNPJ,
      routingReason: `Roteamento ambíguo por CNPJ ${normalizedCnpj}`
    };
  }

  const mailboxMatches = entities.filter((entity) => {
    const recipientAliases = normalizeStringArray(entity.defaultRecipientEmails as Prisma.JsonValue | null);
    const mailboxAliases = normalizeStringArray(entity.defaultMailboxIds as Prisma.JsonValue | null);
    return (
      (normalizedRecipient.length > 0 && recipientAliases.includes(normalizedRecipient)) ||
      (normalizedMailbox.length > 0 && mailboxAliases.includes(normalizedMailbox))
    );
  });

  if (mailboxMatches.length === 1) {
    const match = mailboxMatches[0];
    return {
      companyId: match.companyId,
      legalEntityId: match.id,
      legalEntityName: entityLabel(match),
      routingStatus: DraftRoutingStatus.ROUTED,
      routeSource: DraftRouteSource.MAILBOX,
      routingReason: `Roteado por alias de caixa ${normalizedRecipient || normalizedMailbox}`
    };
  }

  if (mailboxMatches.length > 1) {
    const companyIds = [...new Set(mailboxMatches.map((entity) => entity.companyId))];
    return {
      companyId: companyIds.length === 1 ? companyIds[0] : null,
      legalEntityId: null,
      legalEntityName: null,
      routingStatus: DraftRoutingStatus.UNROUTED,
      routeSource: DraftRouteSource.MAILBOX,
      routingReason: `Roteamento ambíguo por caixa ${normalizedRecipient || normalizedMailbox}`
    };
  }

  const companies = await prisma.company.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 2
  });

  return {
    companyId: companies.length === 1 ? companies[0].id : null,
    legalEntityId: null,
    legalEntityName: null,
    routingStatus: DraftRoutingStatus.UNROUTED,
    routeSource: normalizedCnpj ? DraftRouteSource.CNPJ : DraftRouteSource.UNKNOWN,
    routingReason: normalizedCnpj
      ? `Nenhuma entidade legal encontrada para CNPJ ${normalizedCnpj}`
      : "Nenhuma entidade legal encontrada a partir das pistas de roteamento"
  };
}
