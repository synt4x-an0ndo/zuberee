ALTER TABLE "categories"
    ADD COLUMN "parentId" INTEGER,
    ADD COLUMN "homeCategory" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "sizeGuideType" TEXT,
    ADD COLUMN "trackInventory" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

ALTER TABLE "categories"
    ADD CONSTRAINT "categories_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;