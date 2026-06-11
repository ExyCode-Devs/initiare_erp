import type { PrismaClient } from "@prisma/client";

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeBrazilianDocument(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function hasLetters(value: string | null | undefined) {
  return /[a-zA-Z]/.test(value ?? "");
}

function shouldReplaceClientName(currentName: string, incomingName: string) {
  const normalizedCurrent = normalizeText(currentName);
  const normalizedIncoming = normalizeText(incomingName);
  if (!normalizedIncoming.length || normalizedCurrent === normalizedIncoming) {
    return false;
  }

  if (!hasLetters(currentName) && hasLetters(incomingName)) {
    return true;
  }

  return normalizedIncoming.length > normalizedCurrent.length + 8;
}

function extractDocumentFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidate = [record.document, record.cpfCnpj, record.cnpj_cpf, record.cnpj, record.cpf].find(
    (value) => typeof value === "string" || typeof value === "number"
  );
  return normalizeBrazilianDocument(candidate == null ? null : String(candidate));
}

async function reassignClientReferences(prisma: PrismaClient, duplicateClientId: string, survivorClientId: string) {
  await prisma.accountReceivable.updateMany({
    where: { clientId: duplicateClientId },
    data: { clientId: survivorClientId }
  });

  await prisma.businessClient.updateMany({
    where: { clientId: duplicateClientId },
    data: { clientId: survivorClientId }
  });

  const duplicateSyncs = await prisma.erpSyncRecord.findMany({
    where: {
      entityType: "CLIENT",
      internalId: duplicateClientId
    }
  });

  for (const sync of duplicateSyncs) {
    const existing = await prisma.erpSyncRecord.findFirst({
      where: {
        companyId: sync.companyId,
        provider: sync.provider,
        environment: sync.environment,
        entityType: "CLIENT",
        internalId: survivorClientId
      }
    });

    if (existing) {
      await prisma.erpSyncRecord.delete({
        where: { id: sync.id }
      });
      continue;
    }

    await prisma.erpSyncRecord.update({
      where: { id: sync.id },
      data: { internalId: survivorClientId }
    });
  }
}

function pickSurvivor<T extends { id: string; name: string; document: string | null; createdAt: Date }>(clients: T[]) {
  return [...clients].sort((left, right) => {
    const leftLetterScore = hasLetters(left.name) ? 1 : 0;
    const rightLetterScore = hasLetters(right.name) ? 1 : 0;
    if (leftLetterScore !== rightLetterScore) {
      return rightLetterScore - leftLetterScore;
    }

    const leftNameScore = normalizeText(left.name).length;
    const rightNameScore = normalizeText(right.name).length;
    if (leftNameScore !== rightNameScore) {
      return rightNameScore - leftNameScore;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  })[0];
}

export async function upsertClientIdentity(
  prisma: PrismaClient,
  input: {
    companyId: string;
    name: string;
    document?: string | null;
    segment: string;
    status: string;
    sinceYear: number;
  }
) {
  const normalizedDocument = normalizeBrazilianDocument(input.document);
  const normalizedName = normalizeText(input.name);

  let existing =
    (normalizedDocument
      ? await prisma.client.findFirst({
          where: {
            companyId: input.companyId,
            document: normalizedDocument
          }
        })
      : null) ??
    (normalizedName.length > 0
      ? await prisma.client.findFirst({
          where: {
            companyId: input.companyId,
            name: {
              equals: input.name,
              mode: "insensitive"
            }
          }
        })
      : null);

  if (!existing) {
    return prisma.client.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        document: normalizedDocument,
        segment: input.segment,
        annualRevenue: 0,
        status: input.status,
        sinceYear: input.sinceYear
      }
    });
  }

  const nextName = shouldReplaceClientName(existing.name, input.name) ? input.name : existing.name;
  const nextDocument = existing.document ?? normalizedDocument;
  const nextSegment = existing.segment?.trim().length ? existing.segment : input.segment;
  const nextStatus = existing.status?.trim().length ? existing.status : input.status;

  if (
    existing.name !== nextName ||
    existing.document !== nextDocument ||
    existing.segment !== nextSegment ||
    existing.status !== nextStatus
  ) {
    existing = await prisma.client.update({
      where: { id: existing.id },
      data: {
        name: nextName,
        document: nextDocument,
        segment: nextSegment,
        status: nextStatus
      }
    });
  }

  return existing;
}

export async function reconcileCompanyClientDocuments(prisma: PrismaClient, companyId: string) {
  const clients = await prisma.client.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" }
  });

  const syncs = await prisma.erpSyncRecord.findMany({
    where: {
      companyId,
      entityType: "CLIENT"
    },
    orderBy: { createdAt: "asc" }
  });

  const syncsByClientId = new Map<string, typeof syncs>();
  for (const sync of syncs) {
    const list = syncsByClientId.get(sync.internalId) ?? [];
    list.push(sync);
    syncsByClientId.set(sync.internalId, list);
  }

  for (const client of clients) {
    if (client.document) {
      continue;
    }

    const clientSyncs = syncsByClientId.get(client.id) ?? [];
    const inferredDocument =
      clientSyncs.map((sync) => extractDocumentFromPayload(sync.requestPayload)).find((value) => Boolean(value)) ??
      clientSyncs.map((sync) => extractDocumentFromPayload(sync.responsePayload)).find((value) => Boolean(value)) ??
      null;

    if (!inferredDocument) {
      continue;
    }

    await prisma.client.update({
      where: { id: client.id },
      data: { document: inferredDocument }
    });
    client.document = inferredDocument;
  }

  const refreshedClients = await prisma.client.findMany({
    where: {
      companyId,
      document: {
        not: null
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const groups = new Map<string, typeof refreshedClients>();
  for (const client of refreshedClients) {
    const normalizedDocument = normalizeBrazilianDocument(client.document);
    if (!normalizedDocument) {
      continue;
    }

    const list = groups.get(normalizedDocument) ?? [];
    list.push(client);
    groups.set(normalizedDocument, list);
  }

  for (const [, groupedClients] of groups.entries()) {
    if (groupedClients.length < 2) {
      continue;
    }

    const survivor = pickSurvivor(groupedClients);
    for (const duplicate of groupedClients) {
      if (duplicate.id === survivor.id) {
        continue;
      }

      await reassignClientReferences(prisma, duplicate.id, survivor.id);
      await prisma.client.delete({
        where: { id: duplicate.id }
      });
    }
  }
}
