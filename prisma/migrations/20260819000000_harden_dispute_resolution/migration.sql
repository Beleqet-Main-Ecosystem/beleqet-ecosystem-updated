-- Persist the administrator decision and money metadata needed for an auditable dispute outcome.
ALTER TABLE "disputes"
  ADD COLUMN "resolvedById" TEXT,
  ADD COLUMN "refundAmount" INTEGER,
  ADD COLUMN "refundCurrency" TEXT;

ALTER TABLE "disputes"
  ADD CONSTRAINT "disputes_refund_amount_non_negative"
  CHECK ("refundAmount" IS NULL OR "refundAmount" > 0);
