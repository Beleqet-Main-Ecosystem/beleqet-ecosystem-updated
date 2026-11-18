-- AlterEnum: add MANUAL provider for bank-transfer / manual payments
ALTER TYPE "PaymentProvider" ADD VALUE 'MANUAL';

-- AlterTable: add manual payment fields to payments
ALTER TABLE "payments"
  ADD COLUMN "transactionReference" TEXT,
  ADD COLUMN "receiptUrl"           TEXT;
