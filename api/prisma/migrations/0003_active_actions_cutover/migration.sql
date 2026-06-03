-- CreateEnum
CREATE TYPE "AiEventOriginType" AS ENUM ('ACTIVE_ACTIONS', 'INTERNAL');

-- CreateEnum
CREATE TYPE "AiEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiGatewayRunStatus" AS ENUM ('PENDENTE', 'SUCESSO', 'ERRO');

-- CreateTable
CREATE TABLE "AiEventSource" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "originType" "AiEventOriginType" NOT NULL,
    "channel" TEXT NOT NULL,
    "sender" TEXT,
    "subject" TEXT,
    "summary" TEXT,
    "attachmentsMeta" JSONB,
    "rawPayload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "AiEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "AiEventSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGatewayRun" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "rawResponse" TEXT,
    "parsedResponse" JSONB,
    "status" "AiGatewayRunStatus" NOT NULL DEFAULT 'PENDENTE',
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "eventSourceId" TEXT NOT NULL,

    CONSTRAINT "AiGatewayRun_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FinancialDraft" ALTER COLUMN "sourceLabel" SET DEFAULT 'AI event';
ALTER TABLE "FinancialDraft" ALTER COLUMN "sourceEmailId" DROP NOT NULL;
ALTER TABLE "FinancialDraft" ADD COLUMN     "sourceEventId" TEXT;
ALTER TABLE "FinancialDraft" ADD COLUMN     "aiRunId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AiEventSource_companyId_eventId_key" ON "AiEventSource"("companyId", "eventId");

-- CreateIndex
CREATE INDEX "AiEventSource_companyId_receivedAt_idx" ON "AiEventSource"("companyId", "receivedAt");

-- CreateIndex
CREATE INDEX "AiEventSource_companyId_status_createdAt_idx" ON "AiEventSource"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiGatewayRun_companyId_status_startedAt_idx" ON "AiGatewayRun"("companyId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "AiGatewayRun_eventSourceId_idx" ON "AiGatewayRun"("eventSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialDraft_aiRunId_key" ON "FinancialDraft"("aiRunId");

-- CreateIndex
CREATE INDEX "FinancialDraft_sourceEventId_idx" ON "FinancialDraft"("sourceEventId");

-- AddForeignKey
ALTER TABLE "AiEventSource" ADD CONSTRAINT "AiEventSource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGatewayRun" ADD CONSTRAINT "AiGatewayRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGatewayRun" ADD CONSTRAINT "AiGatewayRun_eventSourceId_fkey" FOREIGN KEY ("eventSourceId") REFERENCES "AiEventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialDraft" ADD CONSTRAINT "FinancialDraft_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "AiEventSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialDraft" ADD CONSTRAINT "FinancialDraft_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiGatewayRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
