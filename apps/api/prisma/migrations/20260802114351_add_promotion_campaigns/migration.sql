-- Superseded in part by 20260802120000_add_campaigns_and_ad_events.
-- Uses dedicated promotion enums so we do not clash with "CampaignStatus".

-- CreateEnum
CREATE TYPE "PromotionTargetType" AS ENUM ('JOB', 'PROPOSAL', 'GIG');

-- CreateEnum
CREATE TYPE "PromotionCampaignStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PromotionEventType" AS ENUM ('IMPRESSION', 'CLICK', 'CONVERSION');

-- CreateTable
CREATE TABLE "promotion_campaigns" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "targetType" "PromotionTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "PromotionCampaignStatus" NOT NULL DEFAULT 'PENDING',
    "cpcBid" INTEGER NOT NULL,
    "dailyBudget" INTEGER NOT NULL,
    "totalBudget" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "spentToday" INTEGER NOT NULL DEFAULT 0,
    "spentTotal" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_events" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" "PromotionEventType" NOT NULL,
    "costApplied" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_wallet_transactions" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotion_campaigns_targetType_targetId_status_idx" ON "promotion_campaigns"("targetType", "targetId", "status");

-- CreateIndex
CREATE INDEX "promotion_campaigns_ownerId_status_idx" ON "promotion_campaigns"("ownerId", "status");

-- CreateIndex
CREATE INDEX "promotion_events_campaignId_type_createdAt_idx" ON "promotion_events"("campaignId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "promotion_wallet_transactions_campaignId_createdAt_idx" ON "promotion_wallet_transactions"("campaignId", "createdAt");

-- AddForeignKey
ALTER TABLE "promotion_campaigns" ADD CONSTRAINT "promotion_campaigns_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_events" ADD CONSTRAINT "promotion_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "promotion_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_wallet_transactions" ADD CONSTRAINT "promotion_wallet_transactions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "promotion_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
