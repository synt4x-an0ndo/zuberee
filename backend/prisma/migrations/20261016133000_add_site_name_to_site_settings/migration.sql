-- Add the store name to site settings (shown in the header when no logo is
-- set, the browser tab title, emails/PDFs, and the footer copyright line).
-- Existing rows get the current store name as the default.
ALTER TABLE "site_settings" ADD COLUMN "siteName" TEXT NOT NULL DEFAULT 'Zuberee';
