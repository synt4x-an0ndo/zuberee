-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "allowPreorder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "colorId" INTEGER,
ADD COLUMN     "held" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lowStockThreshold" INTEGER,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "preorderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "preorderLimit" INTEGER,
ADD COLUMN     "reserved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "product_variants_colorId_idx" ON "product_variants"("colorId");
