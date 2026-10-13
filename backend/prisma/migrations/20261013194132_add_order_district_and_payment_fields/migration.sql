-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "advancePayment" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'cash';

-- CreateIndex
CREATE INDEX "orders_district_idx" ON "orders"("district");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");
