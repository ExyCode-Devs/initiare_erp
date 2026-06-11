-- CreateEnum
CREATE TYPE "AllocationStrategy" AS ENUM ('MANUAL', 'PERCENTAGE', 'VALUE_BAND', 'GROUP');

-- CreateTable
CREATE TABLE "BusinessClient" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "externalCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessClientLegalEntity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "businessClientId" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION,
    "monthlyCap" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessClientLegalEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "businessClientId" TEXT NOT NULL,
    "strategy" "AllocationStrategy" NOT NULL,
    "legalEntityId" TEXT,
    "percentageMap" JSONB,
    "valueBands" JSONB,
    "groupMap" JSONB,
    "monthlyCapMap" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllocationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalAccess" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "businessClientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessClient_companyId_name_key" ON "BusinessClient"("companyId", "name");
CREATE INDEX "BusinessClient_companyId_active_idx" ON "BusinessClient"("companyId", "active");
CREATE INDEX "BusinessClient_clientId_idx" ON "BusinessClient"("clientId");
CREATE UNIQUE INDEX "BusinessClientLegalEntity_businessClientId_legalEntityId_key" ON "BusinessClientLegalEntity"("businessClientId", "legalEntityId");
CREATE INDEX "BusinessClientLegalEntity_companyId_businessClientId_idx" ON "BusinessClientLegalEntity"("companyId", "businessClientId");
CREATE INDEX "AllocationRule_companyId_businessClientId_active_idx" ON "AllocationRule"("companyId", "businessClientId", "active");
CREATE UNIQUE INDEX "PortalAccess_tokenHash_key" ON "PortalAccess"("tokenHash");
CREATE INDEX "PortalAccess_companyId_businessClientId_active_idx" ON "PortalAccess"("companyId", "businessClientId", "active");

-- AddForeignKey
ALTER TABLE "BusinessClient" ADD CONSTRAINT "BusinessClient_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessClient" ADD CONSTRAINT "BusinessClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessClientLegalEntity" ADD CONSTRAINT "BusinessClientLegalEntity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessClientLegalEntity" ADD CONSTRAINT "BusinessClientLegalEntity_businessClientId_fkey" FOREIGN KEY ("businessClientId") REFERENCES "BusinessClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessClientLegalEntity" ADD CONSTRAINT "BusinessClientLegalEntity_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllocationRule" ADD CONSTRAINT "AllocationRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllocationRule" ADD CONSTRAINT "AllocationRule_businessClientId_fkey" FOREIGN KEY ("businessClientId") REFERENCES "BusinessClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AllocationRule" ADD CONSTRAINT "AllocationRule_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalAccess" ADD CONSTRAINT "PortalAccess_businessClientId_fkey" FOREIGN KEY ("businessClientId") REFERENCES "BusinessClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
