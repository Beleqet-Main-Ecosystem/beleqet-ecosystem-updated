-- Phase 2 campaigns: payment pending status, daily spend, FX snapshot, reservation

-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "dailySpent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "dailySpentResetAt" TIMESTAMP(3);
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "fxRate" DOUBLE PRECISION;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "fxFromCurrency" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "fxToCurrency" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "reservedAmountEtb" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "paymentTxRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "campaigns_paymentTxRef_key" ON "campaigns"("paymentTxRef");
