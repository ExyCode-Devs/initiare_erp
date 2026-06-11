ALTER TABLE "Client"
ADD COLUMN "document" TEXT;

CREATE INDEX "Client_companyId_document_idx" ON "Client"("companyId", "document");
