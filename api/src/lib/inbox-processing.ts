import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { AttachmentStatus, DraftStatus, ExtractionRunStatus, InboxStatus, JobRunStatus } from "@prisma/client";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { Attachment } from "mailparser";
import { PDFParse } from "pdf-parse";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";
import { computeConfidence } from "./confidence.js";
import { invokeN8nExtraction } from "./n8n-provider.js";
import { decryptMailboxSecret } from "./mailbox-crypto.js";
import { toNullablePrismaJson, toPrismaJson } from "./prisma-json.js";
import { writeAuditLog } from "./audit.js";
import { persistStoredFile } from "./storage.js";

const MAX_ATTACHMENT_BYTES = env.MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

type ProcessMailboxResult = {
  fetched: number;
  processed: number;
  errors: number;
};

function toRecipientList(value: unknown) {
  if (!value || typeof value !== "object" || !("value" in value) || !Array.isArray(value.value)) {
    return [] as string[];
  }

  return value.value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const name = "name" in item && typeof item.name === "string" ? item.name : "";
      const address = "address" in item && typeof item.address === "string" ? item.address : "";
      return name ? `${name} <${address}>` : address;
    })
    .filter((item): item is string => Boolean(item));
}

function normalizeSender(sender: string) {
  const match = sender.match(/<([^>]+)>/);
  return (match?.[1] ?? sender).trim().toLowerCase();
}

async function readDownloadToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function buildContext(companyId: string) {
  const [suppliers, clients, payableCategories] = await Promise.all([
    prisma.supplier.findMany({
      where: { companyId },
      select: { name: true, category: true }
    }),
    prisma.client.findMany({
      where: { companyId },
      select: { name: true }
    }),
    prisma.accountPayable.findMany({
      where: { companyId },
      select: { category: true },
      distinct: ["category"]
    })
  ]);

  return {
    knownSuppliers: suppliers.map((item) => item.name),
    knownClients: clients.map((item) => item.name),
    knownCategories: Array.from(
      new Set([...suppliers.map((item) => item.category), ...payableCategories.map((item) => item.category)]).values()
    )
  };
}

async function createDraftFromExtraction(params: {
  companyId: string;
  emailId: string;
  extractionRunId: string;
  sender: string;
  attachments: Array<{ mimeType: string; extractedText: string | null }>;
  extraction: Awaited<ReturnType<typeof invokeN8nExtraction>>["parsed"];
}) {
  const { knownSuppliers, knownClients } = await buildContext(params.companyId);
  const senderKnown = knownSuppliers
    .concat(knownClients)
    .some((item) => normalizeSender(item).includes(normalizeSender(params.sender)) || normalizeSender(params.sender).includes(normalizeSender(item)));
  const hasDocument = params.attachments.some((item) => item.mimeType.toLowerCase().includes("pdf"));
  const hasTextConflict =
    params.attachments
      .map((item) => item.extractedText ?? "")
      .filter(Boolean)
      .some((text) => params.extraction.amount && !text.includes(String(Math.trunc(params.extraction.amount)))) === false;

  const confidence = computeConfidence({
    amountFound: Boolean(params.extraction.amount),
    dueDateFound: Boolean(params.extraction.dueDate),
    hasDocument,
    knownSender: senderKnown,
    partyFound: Boolean(params.extraction.partyName),
    cpfCnpjFound: Boolean(params.extraction.cpfCnpj),
    consistentValues: hasTextConflict,
    conflictingValues: !hasTextConflict && hasDocument
  });

  return prisma.financialDraft.create({
    data: {
      companyId: params.companyId,
      sourceEmailId: params.emailId,
      extractionRunId: params.extractionRunId,
      direction: params.extraction.type === "conta_pagar" ? "CONTA_PAGAR" : "CONTA_RECEBER",
      partyName: params.extraction.partyName,
      cpfCnpj: params.extraction.cpfCnpj ?? null,
      amount: params.extraction.amount ?? null,
      dueDate: params.extraction.dueDate ? new Date(params.extraction.dueDate) : null,
      competence: params.extraction.competence ?? null,
      description: params.extraction.description,
      suggestedCategory: params.extraction.suggestedCategory ?? null,
      finalCategory: params.extraction.suggestedCategory ?? null,
      paymentMethod: params.extraction.paymentMethod ?? null,
      bankData: toNullablePrismaJson(params.extraction.bankData ?? null),
      notes: params.extraction.notes ?? null,
      evidence: toPrismaJson(params.extraction.evidence ?? []),
      rawPayload: toPrismaJson(params.extraction),
      confidenceScore: confidence.score,
      confidenceBand: confidence.band,
      status: DraftStatus.PENDENTE_REVISAO
    }
  });
}

async function processStoredEmail(input: {
  companyId: string;
  mailboxId: string;
  externalMessageId: string | null;
  dedupeHash: string;
  sender: string;
  replyTo: string | null;
  toRecipients: string[];
  ccRecipients: string[];
  bccRecipients: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  rawHeaders: Record<string, unknown>;
  originalEmlPath: string;
  receivedAt: Date;
  attachments: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
}) {
  const email = await prisma.inboundEmail.create({
    data: {
      companyId: input.companyId,
      mailboxId: input.mailboxId,
      externalMessageId: input.externalMessageId,
      dedupeHash: input.dedupeHash,
      sender: input.sender,
      replyTo: input.replyTo,
      toRecipients: input.toRecipients,
      ccRecipients: input.ccRecipients,
      bccRecipients: input.bccRecipients,
      subject: input.subject,
      bodyText: input.bodyText,
      bodyHtml: input.bodyHtml,
      rawHeaders: toPrismaJson(input.rawHeaders),
      originalEmlPath: input.originalEmlPath,
      receivedAt: input.receivedAt,
      status: InboxStatus.PROCESSANDO
    }
  });

  const storedAttachments = [];

  for (const attachment of input.attachments) {
    const attachmentDir = `${input.companyId}/emails/${email.id}/attachments`;
    const file = await persistStoredFile(attachmentDir, attachment.filename, attachment.content);

    let extractedText: string | null = null;
    let status: AttachmentStatus = AttachmentStatus.EXTRAIDO;
    let processingError: string | null = null;
    let extractionMeta: Record<string, unknown> | null = null;

    const isPdf = attachment.contentType.toLowerCase().includes("pdf") || attachment.filename.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      if (attachment.content.byteLength > MAX_ATTACHMENT_BYTES) {
        status = AttachmentStatus.ERRO;
        processingError = `Attachment exceeds ${env.MAX_ATTACHMENT_SIZE_MB}MB limit`;
      } else {
        try {
          const parser = new PDFParse({ data: attachment.content });
          const parsedPdf = await parser.getText();
          extractedText = parsedPdf.text?.trim() || null;
          extractionMeta = {
            pages: parsedPdf.pages,
            textLength: extractedText?.length ?? 0
          };
        } catch (error) {
          status = AttachmentStatus.ERRO;
          processingError = error instanceof Error ? error.message : "Failed to parse PDF";
        }
      }
    }

    const storedAttachment = await prisma.emailAttachment.create({
      data: {
        companyId: input.companyId,
        emailId: email.id,
        originalName: attachment.filename,
        mimeType: attachment.contentType,
        sizeBytes: attachment.content.byteLength,
        storagePath: file.relativePath,
        checksum: createHash("sha256").update(attachment.content).digest("hex"),
        extractedText,
        extractionMeta: toNullablePrismaJson(extractionMeta),
        status,
        processingError
      }
    });

    storedAttachments.push(storedAttachment);
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: input.companyId },
    select: { id: true, name: true, domain: true }
  });
  const context = await buildContext(input.companyId);

  const requestPayload = {
    company,
    email: {
      id: email.id,
      sender: input.sender,
      recipients: [...input.toRecipients, ...input.ccRecipients],
      subject: input.subject,
      bodyText: input.bodyText,
      receivedAt: input.receivedAt.toISOString()
    },
    attachments: storedAttachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.originalName,
      mimeType: attachment.mimeType,
      extractedText: attachment.extractedText
    })),
    context
  };

  const extractionRun = await prisma.n8nExtractionRun.create({
    data: {
      companyId: input.companyId,
      emailId: email.id,
      requestPayload: toPrismaJson(requestPayload),
      status: ExtractionRunStatus.PENDENTE
    }
  });

  try {
    const extraction = await invokeN8nExtraction(requestPayload);

    await prisma.n8nExtractionRun.update({
      where: { id: extractionRun.id },
      data: {
        status: ExtractionRunStatus.SUCESSO,
        rawResponse: extraction.rawText,
        parsedResponse: toPrismaJson(extraction.parsed),
        workflowId:
          extraction.parsed.providerMeta && typeof extraction.parsed.providerMeta.workflowId === "string"
            ? extraction.parsed.providerMeta.workflowId
            : null,
        durationMs: extraction.durationMs,
        completedAt: new Date()
      }
    });

    const draft = await createDraftFromExtraction({
      companyId: input.companyId,
      emailId: email.id,
      extractionRunId: extractionRun.id,
      sender: input.sender,
      attachments: storedAttachments.map((attachment) => ({
        mimeType: attachment.mimeType,
        extractedText: attachment.extractedText
      })),
      extraction: extraction.parsed
    });

    await prisma.inboundEmail.update({
      where: { id: email.id },
      data: {
        status: InboxStatus.AGUARDANDO_VALIDACAO
      }
    });

    await writeAuditLog({
      companyId: input.companyId,
      action: "inbox.email.processed",
      resource: "inbound-email",
      details: {
        emailId: email.id,
        draftId: draft.id,
        extractionRunId: extractionRun.id
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction failure";

    await prisma.n8nExtractionRun.update({
      where: { id: extractionRun.id },
      data: {
        status: ExtractionRunStatus.ERRO,
        errorMessage: message,
        completedAt: new Date()
      }
    });

    await prisma.inboundEmail.update({
      where: { id: email.id },
      data: {
        status: InboxStatus.ERRO,
        processingError: message
      }
    });

    await writeAuditLog({
      companyId: input.companyId,
      action: "inbox.email.failed",
      resource: "inbound-email",
      details: {
        emailId: email.id,
        extractionRunId: extractionRun.id,
        error: message
      }
    });

    throw error;
  }
}

export async function testMailboxConnection(mailboxId: string, companyId: string) {
  const mailbox = await prisma.mailboxAccount.findFirstOrThrow({
    where: { id: mailboxId, companyId }
  });

  const client = new ImapFlow({
    host: mailbox.host,
    port: mailbox.port,
    secure: mailbox.tls,
    auth: {
      user: mailbox.username,
      pass: decryptMailboxSecret(mailbox.passwordCipher)
    },
    logger: false
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function processMailboxAccount(mailboxId: string, companyId: string) {
  const mailbox = await prisma.mailboxAccount.findFirstOrThrow({
    where: { id: mailboxId, companyId }
  });

  const jobRun = await prisma.processingJobRun.create({
    data: {
      companyId,
      mailboxId,
      runType: "mailbox.sync"
    }
  });

  const client = new ImapFlow({
    host: mailbox.host,
    port: mailbox.port,
    secure: mailbox.tls,
    auth: {
      user: mailbox.username,
      pass: decryptMailboxSecret(mailbox.passwordCipher)
    },
    logger: false
  });

  const result: ProcessMailboxResult = {
    fetched: 0,
    processed: 0,
    errors: 0
  };

  try {
    await mkdir(path.resolve(env.INGESTION_STORAGE_ROOT), { recursive: true });
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const since = mailbox.lastSyncAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const uids = await client.search({ since });
      const selectedUids = (uids || []).slice(-env.WORKER_BATCH_SIZE);

      for (const uid of selectedUids) {
        const messageMeta = await client.fetchOne(uid, {
          uid: true,
          envelope: true,
          internalDate: true
        });

        if (!messageMeta) {
          continue;
        }

        if (mailbox.fromFilter) {
          const from = messageMeta.envelope?.from?.map((entry) => entry.address).filter(Boolean).join(", ") ?? "";
          if (!from.toLowerCase().includes(mailbox.fromFilter.toLowerCase())) {
            continue;
          }
        }

        const download = await client.download(uid);
        const rawSource = await readDownloadToBuffer(download.content);
        const parsed = await simpleParser(rawSource);
        const externalMessageId = parsed.messageId ?? messageMeta.envelope?.messageId ?? null;
        const dedupeHash = createHash("sha256").update(rawSource).digest("hex");

        const exists = await prisma.inboundEmail.findFirst({
          where: {
            companyId,
            OR: externalMessageId ? [{ externalMessageId }, { dedupeHash }] : [{ dedupeHash }]
          },
          select: { id: true }
        });

        result.fetched += 1;

        if (exists) {
          await writeAuditLog({
            companyId,
            action: "inbox.email.duplicate_skipped",
            resource: "inbound-email",
            details: {
              mailboxId,
              emailId: exists.id,
              externalMessageId
            }
          });
          continue;
        }

        const file = await persistStoredFile(
          `${companyId}/mailboxes/${mailbox.id}/messages`,
          `${messageMeta.uid ?? Date.now()}.eml`,
          rawSource
        );
        const receivedAt =
          parsed.date instanceof Date
            ? parsed.date
            : parsed.date
              ? new Date(parsed.date)
              : messageMeta.internalDate
                ? new Date(messageMeta.internalDate)
                : new Date();

        try {
          await processStoredEmail({
            companyId,
            mailboxId: mailbox.id,
            externalMessageId,
            dedupeHash,
            sender:
              parsed.from?.text ??
              messageMeta.envelope?.from?.map((entry) => entry.address || entry.name).filter(Boolean).join(", ") ??
              "desconhecido",
            replyTo: parsed.replyTo?.text ?? null,
            toRecipients: toRecipientList(parsed.to),
            ccRecipients: toRecipientList(parsed.cc),
            bccRecipients: toRecipientList(parsed.bcc),
            subject: parsed.subject ?? messageMeta.envelope?.subject ?? "(sem assunto)",
            bodyText: parsed.text?.trim() || "",
            bodyHtml: typeof parsed.html === "string" ? parsed.html : null,
            rawHeaders: Object.fromEntries(parsed.headers),
            originalEmlPath: file.relativePath,
            receivedAt,
            attachments: (parsed.attachments ?? []).map((attachment: Attachment) => ({
              filename: attachment.filename ?? "attachment.bin",
              contentType: attachment.contentType,
              content: attachment.content
            }))
          });
          result.processed += 1;
        } catch {
          result.errors += 1;
        }
      }
    } finally {
      lock.release();
      await client.logout().catch(() => undefined);
    }

    await prisma.mailboxAccount.update({
      where: { id: mailbox.id },
      data: {
        lastSyncAt: new Date(),
        lastError: null
      }
    });

    await prisma.processingJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: JobRunStatus.COMPLETED,
        fetchedCount: result.fetched,
        processedCount: result.processed,
        errorCount: result.errors,
        finishedAt: new Date(),
        summary: toPrismaJson(result)
      }
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailbox sync failed";

    await prisma.mailboxAccount.update({
      where: { id: mailbox.id },
      data: {
        lastError: message
      }
    });

    await prisma.processingJobRun.update({
      where: { id: jobRun.id },
      data: {
        status: JobRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message,
        fetchedCount: result.fetched,
        processedCount: result.processed,
        errorCount: result.errors
      }
    });

    throw error;
  }
}

export async function processActiveMailboxes() {
  const mailboxes = await prisma.mailboxAccount.findMany({
    where: {
      active: true
    },
    select: {
      id: true,
      companyId: true
    }
  });

  for (const mailbox of mailboxes) {
    try {
      await processMailboxAccount(mailbox.id, mailbox.companyId);
    } catch (error) {
      console.error(`[worker] mailbox ${mailbox.id} failed`, error);
    }
  }
}
