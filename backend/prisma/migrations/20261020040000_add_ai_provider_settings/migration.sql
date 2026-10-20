ALTER TABLE "site_settings"
ADD COLUMN "aiApiKey" TEXT,
ADD COLUMN "aiApiBaseUrl" TEXT,
ADD COLUMN "aiApiModel" TEXT;

UPDATE "site_settings"
SET "aiApiKey" = "geminiApiKey"
WHERE "aiApiKey" IS NULL
  AND "geminiApiKey" IS NOT NULL;
