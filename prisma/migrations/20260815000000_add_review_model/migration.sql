-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "transactionCurrency" TEXT NOT NULL DEFAULT 'USD',
    "gdprConsentGiven" BOOLEAN NOT NULL DEFAULT false,
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_freelancerId_idx" ON "reviews"("freelancerId");

-- CreateIndex
CREATE INDEX "reviews_customerId_idx" ON "reviews"("customerId");

-- CreateIndex
CREATE INDEX "reviews_createdAt_idx" ON "reviews"("createdAt");
