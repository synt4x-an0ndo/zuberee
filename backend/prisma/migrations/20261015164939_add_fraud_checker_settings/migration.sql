-- CreateTable
CREATE TABLE "fraud_checker_settings" (
    "id" SERIAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cacheMinutes" INTEGER NOT NULL DEFAULT 60,
    "apiKey" TEXT,
    "providerUrl" TEXT NOT NULL DEFAULT 'https://api.bdcourier.com/courier-check',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_checker_settings_pkey" PRIMARY KEY ("id")
);
