-- CreateEnum
CREATE TYPE "DraftRoutingStatus" AS ENUM ('ROUTED', 'UNROUTED');

-- CreateEnum
CREATE TYPE "DraftRouteSource" AS ENUM ('CNPJ', 'MAILBOX', 'MANUAL', 'UNKNOWN');

-- CreateTable
CREATE TABLE "LegalEntity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "cnpj" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "defaultRecipientEmails" JSONB,
    "defaultMailboxIds" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "InboundEmail" ADD COLUMN "legalEntityId" TEXT;

-- AlterTable
ALTER TABLE "FinancialDraft"
ADD COLUMN "legalEntityId" TEXT,
ADD COLUMN "routingStatus" "DraftRoutingStatus" NOT NULL DEFAULT 'UNROUTED',
ADD COLUMN "routeSource" "DraftRouteSource" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "routingReason" TEXT;

-- AlterTable
ALTER TABLE "ErpConnection" ADD COLUMN "legalEntityId" TEXT;

-- AlterTable
ALTER TABLE "AiEventSource"
ADD COLUMN "legalEntityId" TEXT,
ADD COLUMN "routingStatus" "DraftRoutingStatus" NOT NULL DEFAULT 'UNROUTED',
ADD COLUMN "routeSource" "DraftRouteSource" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "routingReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LegalEntity_companyId_cnpj_key" ON "LegalEntity"("companyId", "cnpj");

-- CreateIndex
CREATE INDEX "LegalEntity_companyId_active_idx" ON "LegalEntity"("companyId", "active");

-- CreateIndex
CREATE INDEX "InboundEmail_legalEntityId_receivedAt_idx" ON "InboundEmail"("legalEntityId", "receivedAt");

-- CreateIndex
CREATE INDEX "FinancialDraft_legalEntityId_status_createdAt_idx" ON "FinancialDraft"("legalEntityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiEventSource_legalEntityId_createdAt_idx" ON "AiEventSource"("legalEntityId", "createdAt");

-- Data migration, one default entity per company
INSERT INTO "LegalEntity" ("id", "companyId", "legalName", "tradeName", "cnpj", "active", "isDefault", "notes", "createdAt", "updatedAt")
SELECT
  CONCAT('le_', "id"),
  "id",
  "name",
  "name",
  CONCAT('default-', "id"),
  true,
  true,
  'Auto-created during multi legal entity migration',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company";

-- Backfill references to default entity
UPDATE "ErpConnection" ec
SET "legalEntityId" = le."id"
FROM "LegalEntity" le
WHERE le."companyId" = ec."companyId"
  AND le."isDefault" = true
  AND ec."legalEntityId" IS NULL;

UPDATE "FinancialDraft" fd
SET "legalEntityId" = le."id",
    "routingStatus" = 'ROUTED',
    "routeSource" = 'MANUAL',
    "routingReason" = COALESCE(fd."routingReason", 'Backfilled to default legal entity during migration')
FROM "LegalEntity" le
WHERE le."companyId" = fd."companyId"
  AND le."isDefault" = true
  AND fd."legalEntityId" IS NULL;

UPDATE "AiEventSource" aes
SET "legalEntityId" = le."id",
    "routingStatus" = 'ROUTED',
    "routeSource" = 'MANUAL',
    "routingReason" = COALESCE(aes."routingReason", 'Backfilled to default legal entity during migration')
FROM "LegalEntity" le
WHERE le."companyId" = aes."companyId"
  AND le."isDefault" = true
  AND aes."legalEntityId" IS NULL;

UPDATE "InboundEmail" ie
SET "legalEntityId" = le."id"
FROM "LegalEntity" le
WHERE le."companyId" = ie."companyId"
  AND le."isDefault" = true
  AND ie."legalEntityId" IS NULL;

-- Rebuild connection uniqueness by legal entity
DROP INDEX "ErpConnection_companyId_provider_environment_key";

ALTER TABLE "ErpConnection"
ALTER COLUMN "legalEntityId" SET NOT NULL;

CREATE UNIQUE INDEX "ErpConnection_legalEntityId_provider_environment_key"
ON "ErpConnection"("legalEntityId", "provider", "environment");

CREATE INDEX "ErpConnection_companyId_legalEntityId_provider_enabled_idx"
ON "ErpConnection"("companyId", "legalEntityId", "provider", "enabled");

-- Foreign keys
ALTER TABLE "LegalEntity" ADD CONSTRAINT "LegalEntity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialDraft" ADD CONSTRAINT "FinancialDraft_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ErpConnection" ADD CONSTRAINT "ErpConnection_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiEventSource" ADD CONSTRAINT "AiEventSource_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
