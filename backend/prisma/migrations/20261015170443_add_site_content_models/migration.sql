-- CreateTable
CREATE TABLE "about_us" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "about_us_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footer_settings" (
    "id" SERIAL NOT NULL,
    "logoPath" TEXT,
    "companyDescription" TEXT,
    "companyAddress" TEXT,
    "companyEmail" TEXT,
    "companyPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "footer_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" SERIAL NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#092009',
    "inventoryEnforcementEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_links" (
    "id" SERIAL NOT NULL,
    "facebook" TEXT,
    "youtube" TEXT,
    "instagram" TEXT,
    "twitter" TEXT,
    "pinterest" TEXT,
    "facebookId" TEXT,
    "whatsappNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facebook_settings" (
    "id" SERIAL NOT NULL,
    "pixelId" TEXT,
    "accessToken" TEXT,
    "testEventCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTestMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_settings_pkey" PRIMARY KEY ("id")
);
