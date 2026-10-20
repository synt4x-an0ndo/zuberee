-- AlterTable
ALTER TABLE "abandoned_checkouts" ADD COLUMN "district" TEXT,
ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE INDEX "abandoned_checkouts_userId_idx" ON "abandoned_checkouts"("userId");
