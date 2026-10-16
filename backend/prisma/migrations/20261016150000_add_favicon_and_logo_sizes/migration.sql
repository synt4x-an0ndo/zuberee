-- Favicon + per-placement logo sizing for site settings.
-- faviconPath: dedicated browser-tab icon (falls back to the store logo).
-- faviconZoom: how much of the square favicon the image fills (percent).
-- logoSizes: JSON map of { header|footer|auth|adminSidebar|adminLogin|invoice: { width, height } }.
ALTER TABLE "site_settings" ADD COLUMN "faviconPath" TEXT;
ALTER TABLE "site_settings" ADD COLUMN "faviconZoom" INTEGER NOT NULL DEFAULT 85;
ALTER TABLE "site_settings" ADD COLUMN "logoSizes" JSONB;
