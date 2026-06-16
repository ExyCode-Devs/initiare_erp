ALTER TABLE "N8nExtractionRun"
  ALTER COLUMN "provider" SET DEFAULT 'activepieces';

UPDATE "N8nExtractionRun"
SET "provider" = 'activepieces'
WHERE "provider" = 'n8n';
