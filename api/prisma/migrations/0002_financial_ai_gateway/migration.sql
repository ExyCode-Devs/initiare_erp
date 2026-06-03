-- CreateEnum
CREATE TYPE "InboxStatus" AS ENUM ('RECEBIDO', 'PROCESSANDO', 'PROCESSADO', 'AGUARDANDO_VALIDACAO', 'APROVADO', 'REJEITADO', 'ERRO');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDENTE', 'EXTRAIDO', 'ERRO');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDENTE_REVISAO', 'APROVADO', 'REJEITADO');

-- CreateEnum
CREATE TYPE "ConfidenceBand" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');

-- CreateEnum
CREATE TYPE "ChangelogCategory" AS ENUM ('NOVA_FUNCIONALIDADE', 'MELHORIA', 'CORRECAO', 'INTEGRACAO', 'IA', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "ChangelogStatus" AS ENUM ('RASCUNHO', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "ExtractionRunStatus" AS ENUM ('PENDENTE', 'SUCESSO', 'ERRO');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FinancialDirection" AS ENUM ('CONTA_PAGAR', 'CONTA_RECEBER');

-- CreateEnum
CREATE TYPE "ReviewAction" AS ENUM ('EDIT', 'APPROVE', 'REJECT');

-- CreateTable
CREATE TABLE "MailboxAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "tls" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT NOT NULL,
    "passwordCipher" TEXT NOT NULL,
    "fromFilter" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "MailboxAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "externalMessageId" TEXT,
    "dedupeHash" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "replyTo" TEXT,
    "toRecipients" JSONB NOT NULL,
    "ccRecipients" JSONB,
    "bccRecipients" JSONB,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "rawHeaders" JSONB NOT NULL,
    "originalEmlPath" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "InboxStatus" NOT NULL DEFAULT 'RECEBIDO',
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAttachment" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "extractedText" TEXT,
    "extractionMeta" JSONB,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDENTE',
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,

    CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "N8nExtractionRun" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'n8n',
    "workflowId" TEXT,
    "requestPayload" JSONB NOT NULL,
    "rawResponse" TEXT,
    "parsedResponse" JSONB,
    "status" "ExtractionRunStatus" NOT NULL DEFAULT 'PENDENTE',
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,

    CONSTRAINT "N8nExtractionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialDraft" (
    "id" TEXT NOT NULL,
    "direction" "FinancialDirection" NOT NULL,
    "partyName" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "amount" DECIMAL(14,2),
    "dueDate" TIMESTAMP(3),
    "competence" TEXT,
    "description" TEXT NOT NULL,
    "suggestedCategory" TEXT,
    "finalCategory" TEXT,
    "paymentMethod" TEXT,
    "bankData" JSONB,
    "notes" TEXT,
    "evidence" JSONB,
    "rawPayload" JSONB NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "confidenceBand" "ConfidenceBand" NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDENTE_REVISAO',
    "sourceLabel" TEXT NOT NULL DEFAULT 'Email + n8n',
    "rejectionReason" TEXT,
    "resultingResourceType" TEXT,
    "resultingResourceId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceEmailId" TEXT NOT NULL,
    "extractionRunId" TEXT,

    CONSTRAINT "FinancialDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialDraftReview" (
    "id" TEXT NOT NULL,
    "action" "ReviewAction" NOT NULL,
    "note" TEXT,
    "fieldDelta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FinancialDraftReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJobRun" (
    "id" TEXT NOT NULL,
    "runType" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'RUNNING',
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "mailboxId" TEXT,

    CONSTRAINT "ProcessingJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangelogEntry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "category" "ChangelogCategory" NOT NULL,
    "status" "ChangelogStatus" NOT NULL DEFAULT 'RASCUNHO',
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "ChangelogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangelogRead" (
    "id" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ChangelogRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailboxAccount_companyId_active_idx" ON "MailboxAccount"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_externalMessageId_key" ON "InboundEmail"("externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_dedupeHash_key" ON "InboundEmail"("dedupeHash");

-- CreateIndex
CREATE INDEX "InboundEmail_companyId_status_receivedAt_idx" ON "InboundEmail"("companyId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "InboundEmail_mailboxId_receivedAt_idx" ON "InboundEmail"("mailboxId", "receivedAt");

-- CreateIndex
CREATE INDEX "EmailAttachment_companyId_status_idx" ON "EmailAttachment"("companyId", "status");

-- CreateIndex
CREATE INDEX "EmailAttachment_emailId_idx" ON "EmailAttachment"("emailId");

-- CreateIndex
CREATE INDEX "N8nExtractionRun_companyId_status_startedAt_idx" ON "N8nExtractionRun"("companyId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "N8nExtractionRun_emailId_idx" ON "N8nExtractionRun"("emailId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDraft_extractionRunId_key" ON "FinancialDraft"("extractionRunId");

-- CreateIndex
CREATE INDEX "FinancialDraft_companyId_status_confidenceBand_idx" ON "FinancialDraft"("companyId", "status", "confidenceBand");

-- CreateIndex
CREATE INDEX "FinancialDraft_sourceEmailId_idx" ON "FinancialDraft"("sourceEmailId");

-- CreateIndex
CREATE INDEX "FinancialDraftReview_companyId_createdAt_idx" ON "FinancialDraftReview"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialDraftReview_draftId_idx" ON "FinancialDraftReview"("draftId");

-- CreateIndex
CREATE INDEX "ProcessingJobRun_companyId_status_startedAt_idx" ON "ProcessingJobRun"("companyId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "ProcessingJobRun_mailboxId_idx" ON "ProcessingJobRun"("mailboxId");

-- CreateIndex
CREATE INDEX "ChangelogEntry_companyId_status_publishedAt_idx" ON "ChangelogEntry"("companyId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "ChangelogRead_companyId_userId_idx" ON "ChangelogRead"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangelogRead_entryId_userId_key" ON "ChangelogRead"("entryId", "userId");

-- AddForeignKey
ALTER TABLE "MailboxAccount" ADD CONSTRAINT "MailboxAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "MailboxAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "InboundEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "N8nExtractionRun" ADD CONSTRAINT "N8nExtractionRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "N8nExtractionRun" ADD CONSTRAINT "N8nExtractionRun_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "InboundEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialDraft" ADD CONSTRAINT "FinancialDraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialDraft" ADD CONSTRAINT "FinancialDraft_sourceEmailId_fkey" FOREIGN KEY ("sourceEmailId") REFERENCES "InboundEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialDraft" ADD CONSTRAINT "FinancialDraft_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "N8nExtractionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialDraftReview" ADD CONSTRAINT "FinancialDraftReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialDraftReview" ADD CONSTRAINT "FinancialDraftReview_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "FinancialDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialDraftReview" ADD CONSTRAINT "FinancialDraftReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJobRun" ADD CONSTRAINT "ProcessingJobRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessingJobRun" ADD CONSTRAINT "ProcessingJobRun_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "MailboxAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogRead" ADD CONSTRAINT "ChangelogRead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogRead" ADD CONSTRAINT "ChangelogRead_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ChangelogEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogRead" ADD CONSTRAINT "ChangelogRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

