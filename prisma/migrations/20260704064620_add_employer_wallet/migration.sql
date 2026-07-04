-- AlterTable
ALTER TABLE "escrow_transactions" ADD COLUMN     "walletAppliedAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "employer_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "lockedBalance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employer_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employer_wallet_transactions" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "escrowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employer_wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employer_wallets_userId_key" ON "employer_wallets"("userId");

-- CreateIndex
CREATE INDEX "employer_wallet_transactions_walletId_createdAt_idx" ON "employer_wallet_transactions"("walletId", "createdAt");

-- AddForeignKey
ALTER TABLE "employer_wallets" ADD CONSTRAINT "employer_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employer_wallet_transactions" ADD CONSTRAINT "employer_wallet_transactions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "employer_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
