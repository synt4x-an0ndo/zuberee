-- CreateEnum
CREATE TYPE "SizeGuideType" AS ENUM ('NONE', 'SHOE', 'DRESS');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "displayPriority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentId" INTEGER,
ADD COLUMN     "showOnHomepage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sizeGuideType" "SizeGuideType" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "stockTracking" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE INDEX "categories_displayPriority_idx" ON "categories"("displayPriority");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
