-- Persist the inventory source used for every new order item. Existing orders
-- predate product-level-with-sizes behaviour, so their historic allocation was
-- per variant whenever a variant id was present.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "stockMode" VARCHAR(16);
UPDATE "order_items"
SET "stockMode" = CASE WHEN "variantId" IS NULL THEN 'PRODUCT' ELSE 'VARIANT' END
WHERE "stockMode" IS NULL;
