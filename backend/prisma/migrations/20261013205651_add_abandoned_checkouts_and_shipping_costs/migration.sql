-- CreateTable
CREATE TABLE "abandoned_checkouts" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT,
    "userId" INTEGER,
    "cartItems" JSONB NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "isRecovered" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "convertedOrderId" INTEGER,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abandoned_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_costs" (
    "id" SERIAL NOT NULL,
    "insideDhaka" DECIMAL(10,2) NOT NULL DEFAULT 80,
    "outsideDhaka" DECIMAL(10,2) NOT NULL DEFAULT 150,
    "oneShippingCost" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "abandoned_checkouts_sessionId_key" ON "abandoned_checkouts"("sessionId");

-- CreateIndex
CREATE INDEX "abandoned_checkouts_sessionId_idx" ON "abandoned_checkouts"("sessionId");

-- CreateIndex
CREATE INDEX "abandoned_checkouts_status_idx" ON "abandoned_checkouts"("status");

-- CreateIndex
CREATE INDEX "abandoned_checkouts_createdAt_idx" ON "abandoned_checkouts"("createdAt");
