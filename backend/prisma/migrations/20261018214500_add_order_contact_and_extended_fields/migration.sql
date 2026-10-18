-- Order-level contact snapshot (for guest and account orders) plus the
-- courier/delivery-note fields used by the admin order editor.
ALTER TABLE "orders" ADD COLUMN "contactName" TEXT;
ALTER TABLE "orders" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "orders" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "orders" ADD COLUMN "courierEntry" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryNotes" TEXT;

-- Preserve the variant chosen for each future order line and a printable
-- size snapshot (the snapshot remains if a variant is later deleted).
ALTER TABLE "order_items" ADD COLUMN "variantId" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "size" TEXT;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");

-- Backfill the new snapshot from the best contact data already stored.
UPDATE "orders"
SET "contactName" = "guestName",
    "contactPhone" = "guestPhone"
WHERE "userId" IS NULL;

UPDATE "orders" AS o
SET "contactName" = u."name",
    "contactPhone" = u."phone",
    "contactEmail" = u."email"
FROM "users" AS u
WHERE o."userId" = u."id";
