-- Make inventory ownership explicit and repair existing denormalised counters.
-- Variant stock is authoritative for products that have variants; product stock
-- remains authoritative only for products without variants.

CREATE TABLE "product_stock_movements" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "note" TEXT,
    "userId" INTEGER,
    "orderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_stock_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_stock_movements_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "products"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "product_stock_movements_productId_idx" ON "product_stock_movements"("productId");
CREATE INDEX "product_stock_movements_orderId_idx" ON "product_stock_movements"("orderId");
CREATE INDEX "product_stock_movements_createdAt_idx" ON "product_stock_movements"("createdAt");

-- `reserved` is retained for API compatibility and now mirrors `held`.
UPDATE "product_variants" SET "reserved" = "held";

-- For a product family, product.stock is a derived compatibility total, not a
-- separately mutable counter. This removes existing negative/drifted values.
UPDATE "products" AS p
SET "stock" = totals."stock"
FROM (
    SELECT "productId", COALESCE(SUM("stock"), 0)::INTEGER AS "stock"
    FROM "product_variants"
    GROUP BY "productId"
) AS totals
WHERE totals."productId" = p."id";

-- Append an auditable baseline rather than rewriting historical movements.
INSERT INTO "stock_movements" (
    "productVariantId", "type", "quantity", "stockAfter", "reservedAfter", "note"
)
SELECT
    pv."id", 'adjustment', 0, pv."stock", pv."held", 'Inventory integrity baseline after stock reconciliation'
FROM "product_variants" pv;

INSERT INTO "product_stock_movements" (
    "productId", "type", "quantity", "stockAfter", "note"
)
SELECT
    p."id", 'adjustment', 0, p."stock", 'Inventory integrity baseline after stock reconciliation'
FROM "products" p
WHERE NOT EXISTS (
    SELECT 1 FROM "product_variants" pv WHERE pv."productId" = p."id"
);

ALTER TABLE "product_variants"
    ADD CONSTRAINT "product_variants_stock_nonnegative" CHECK ("stock" >= 0),
    ADD CONSTRAINT "product_variants_held_nonnegative" CHECK ("held" >= 0),
    ADD CONSTRAINT "product_variants_reserved_nonnegative" CHECK ("reserved" >= 0),
    ADD CONSTRAINT "product_variants_stock_covers_held" CHECK ("stock" >= "held"),
    ADD CONSTRAINT "product_variants_reserved_matches_held" CHECK ("reserved" = "held"),
    ADD CONSTRAINT "product_variants_preorder_count_nonnegative" CHECK ("preorderCount" >= 0);

ALTER TABLE "products"
    ADD CONSTRAINT "products_stock_nonnegative" CHECK ("stock" >= 0);
