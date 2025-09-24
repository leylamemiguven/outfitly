-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "productUrl" TEXT,
    "imageUrl" TEXT NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "sizes" JSONB,
    "colorLab" JSONB NOT NULL,
    "attributes" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
