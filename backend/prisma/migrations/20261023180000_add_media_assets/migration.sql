-- Uploaded images are stored in Postgres so a running production server can
-- serve them immediately. Next.js only serves files that were inside `public/`
-- when the build ran, so runtime uploads used to 404 until a rebuild/restart.

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_assets_folder_idx" ON "media_assets"("folder");

-- CreateIndex
CREATE INDEX "media_assets_createdAt_idx" ON "media_assets"("createdAt");
