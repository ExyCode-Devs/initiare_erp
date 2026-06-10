-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_companyId_fkey";

-- AlterTable
ALTER TABLE "Company"
ADD COLUMN "replyFromEmail" TEXT,
ADD COLUMN "replyFromName" TEXT,
ADD COLUMN "replyToEmail" TEXT;

-- AlterTable
ALTER TABLE "MailboxAccount"
ADD COLUMN "legalEntityId" TEXT;

-- CreateTable
CREATE TABLE "UserCompanyMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCompanyMembership_pkey" PRIMARY KEY ("id")
);

-- Backfill existing user-company ownership into memberships before dropping legacy column
INSERT INTO "UserCompanyMembership" ("id", "userId", "companyId", "role", "isDefault", "createdAt", "updatedAt")
SELECT
  concat('mship_', md5("id" || ':' || "companyId")),
  "id",
  "companyId",
  "role",
  true,
  "createdAt",
  CURRENT_TIMESTAMP
FROM "User"
WHERE "companyId" IS NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "companyId";

-- CreateIndex
CREATE INDEX "UserCompanyMembership_companyId_role_idx" ON "UserCompanyMembership"("companyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "UserCompanyMembership_userId_companyId_key" ON "UserCompanyMembership"("userId", "companyId");

-- CreateIndex
CREATE INDEX "MailboxAccount_legalEntityId_active_idx" ON "MailboxAccount"("legalEntityId", "active");

-- AddForeignKey
ALTER TABLE "UserCompanyMembership"
ADD CONSTRAINT "UserCompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompanyMembership"
ADD CONSTRAINT "UserCompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailboxAccount"
ADD CONSTRAINT "MailboxAccount_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
