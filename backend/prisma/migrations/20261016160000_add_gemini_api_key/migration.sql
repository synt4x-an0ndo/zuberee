-- Gemini API key for the AI shopping assistant (server-only secret;
-- never exposed by the public site-settings endpoint).
ALTER TABLE "site_settings" ADD COLUMN "geminiApiKey" TEXT;
