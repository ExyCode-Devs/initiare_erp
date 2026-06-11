-- CreateEnum
CREATE TYPE "ErpProvider" AS ENUM ('OMIE');

-- CreateEnum
CREATE TYPE "ErpEnvironment" AS ENUM ('HOMOLOG', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "ErpHealthStatus" AS ENUM ('UNKNOWN', 'HEALTHY', 'ERROR');

-- CreateEnum
CREATE TYPE "ErpSyncEntityType" AS ENUM ('CLIENT', 'SUPPLIER', 'CATEGORY', 'CURRENT_ACCOUNT', 'ACCOUNT_PAYABLE', 'ACCOUNT_RECEIVABLE');

-- CreateEnum
CREATE TYPE "ErpSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'ERROR', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ErpOperationStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "ErpConnection" (
    "id" TEXT NOT NULL,
    "provider" "ErpProvider" NOT NULL,
    "environment" "ErpEnvironment" NOT NULL,
    "appKeyCipher" TEXT,
    "appSecretCipher" TEXT,
    "baseUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "lastHealthcheckAt" TIMESTAMP(3),
    "lastHealthcheckStatus" "ErpHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ErpConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSyncRecord" (
    "id" TEXT NOT NULL,
    "provider" "ErpProvider" NOT NULL,
    "environment" "ErpEnvironment" NOT NULL,
    "entityType" "ErpSyncEntityType" NOT NULL,
    "internalId" TEXT NOT NULL,
    "externalId" TEXT,
    "status" "ErpSyncStatus" NOT NULL DEFAULT 'PENDING',
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "draftId" TEXT,

    CONSTRAINT "ErpSyncRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpRequestLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "httpStatus" INTEGER,
    "operationStatus" "ErpOperationStatus" NOT NULL,
    "friendlyError" TEXT,
    "technicalError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "draftId" TEXT,
    "triggeredByUserId" TEXT,

    CONSTRAINT "ErpRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErpConnection_companyId_provider_environment_key" ON "ErpConnection"("companyId", "provider", "environment");

-- CreateIndex
CREATE INDEX "ErpConnection_companyId_provider_enabled_idx" ON "ErpConnection"("companyId", "provider", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSyncRecord_companyId_provider_environment_entityType_internalI_key" ON "ErpSyncRecord"("companyId", "provider", "environment", "entityType", "internalId");

-- CreateIndex
CREATE INDEX "ErpSyncRecord_companyId_status_updatedAt_idx" ON "ErpSyncRecord"("companyId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ErpSyncRecord_draftId_updatedAt_idx" ON "ErpSyncRecord"("draftId", "updatedAt");

-- CreateIndex
CREATE INDEX "ErpRequestLog_companyId_createdAt_idx" ON "ErpRequestLog"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ErpRequestLog_draftId_createdAt_idx" ON "ErpRequestLog"("draftId", "createdAt");

-- CreateIndex
CREATE INDEX "ErpRequestLog_connectionId_createdAt_idx" ON "ErpRequestLog"("connectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ErpConnection" ADD CONSTRAINT "ErpConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSyncRecord" ADD CONSTRAINT "ErpSyncRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSyncRecord" ADD CONSTRAINT "ErpSyncRecord_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ErpConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSyncRecord" ADD CONSTRAINT "ErpSyncRecord_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "FinancialDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpRequestLog" ADD CONSTRAINT "ErpRequestLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpRequestLog" ADD CONSTRAINT "ErpRequestLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ErpConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpRequestLog" ADD CONSTRAINT "ErpRequestLog_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "FinancialDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpRequestLog" ADD CONSTRAINT "ErpRequestLog_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
