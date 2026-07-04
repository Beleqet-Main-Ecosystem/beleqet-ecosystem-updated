-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "originalAmount" INTEGER;

-- AlterTable
ALTER TABLE "employer_wallet_transactions" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "originalAmount" INTEGER;