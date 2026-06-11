-- AlterEnum
ALTER TYPE "ErpProvider" ADD VALUE 'ASAAS';

-- AlterEnum
ALTER TYPE "ErpEnvironment" ADD VALUE 'SANDBOX';

-- AlterEnum
ALTER TYPE "ErpSyncEntityType" ADD VALUE 'CHARGE';
ALTER TYPE "ErpSyncEntityType" ADD VALUE 'PAYMENT_RECEIPT';
ALTER TYPE "ErpSyncEntityType" ADD VALUE 'FEE';

-- AlterTable
ALTER TABLE "ErpConnection" ADD COLUMN "webhookAuthTokenCipher" TEXT;

-- CreateTable
CREATE TABLE "ErpWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "ErpProvider" NOT NULL,
    "environment" "ErpEnvironment" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "headers" JSONB,
    "payload" JSONB NOT NULL,
    "status" "ErpSyncStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "connectionId" TEXT,
    "triggeredByUserId" TEXT,

    CONSTRAINT "ErpWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErpWebhookEvent_companyId_provider_environment_externalEven_key" ON "ErpWebhookEvent"("companyId", "provider", "environment", "externalEventId");

-- CreateIndex
CREATE INDEX "ErpWebhookEvent_companyId_provider_createdAt_idx" ON "ErpWebhookEvent"("companyId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX "ErpWebhookEvent_connectionId_createdAt_idx" ON "ErpWebhookEvent"("connectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ErpWebhookEvent" ADD CONSTRAINT "ErpWebhookEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpWebhookEvent" ADD CONSTRAINT "ErpWebhookEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ErpConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpWebhookEvent" ADD CONSTRAINT "ErpWebhookEvent_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
