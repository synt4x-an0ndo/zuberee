-- CreateTable
CREATE TABLE "banners" (
    "id" SERIAL NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "link" TEXT,
    "displayPriority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banners_displayPriority_idx" ON "banners"("displayPriority");

-- CreateIndex
CREATE INDEX "banners_isActive_idx" ON "banners"("isActive");
