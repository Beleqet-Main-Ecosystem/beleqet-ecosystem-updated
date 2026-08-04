-- AlterTable
ALTER TABLE "fraud_alerts" ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "fraud_alerts" ADD COLUMN IF NOT EXISTS "legalBasis" TEXT NOT NULL DEFAULT 'legitimate_interest';
ALTER TABLE "fraud_alerts" ADD COLUMN IF NOT EXISTS "expiryAt" TIMESTAMP(3);
ALTER TABLE "fraud_alerts" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "fraud_alerts" ADD COLUMN IF NOT EXISTS "anonymizedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fraud_alerts_expiryAt_idx" ON "fraud_alerts"("expiryAt");
