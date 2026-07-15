-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX "idx_applications_created_at_brin";

-- DropIndex
DROP INDEX "idx_applications_job_status_created";

-- DropIndex
DROP INDEX "idx_applications_user_created";

-- DropIndex
DROP INDEX "idx_candidate_scores_overall";

-- DropIndex
DROP INDEX "idx_chat_participants_user";

-- DropIndex
DROP INDEX "idx_events_log_created_at_brin";

-- DropIndex
DROP INDEX "idx_events_log_type_entity";

-- DropIndex
DROP INDEX "idx_freelance_jobs_budget";

-- DropIndex
DROP INDEX "idx_freelance_jobs_created_at_brin";

-- DropIndex
DROP INDEX "idx_freelance_jobs_skills_gin";

-- DropIndex
DROP INDEX "idx_jobs_created_at_brin";

-- DropIndex
DROP INDEX "idx_jobs_tags_gin";

-- DropIndex
DROP INDEX "idx_messages_created_at_brin";

-- DropIndex
DROP INDEX "idx_messages_room_created";

-- DropIndex
DROP INDEX "idx_notifications_created_at_brin";

-- DropIndex
DROP INDEX "payments_userId_createdAt_idx";

-- DropIndex
DROP INDEX "idx_referrals_created_at_brin";

-- DropIndex
DROP INDEX "idx_refresh_tokens_expires";

-- DropIndex
DROP INDEX "idx_users_created_at_brin";

-- DropIndex
DROP INDEX "idx_users_role";

-- DropIndex
DROP INDEX "idx_users_skills_gin";

-- DropIndex
DROP INDEX "idx_wallet_tx_created_at_brin";

-- DropIndex
DROP INDEX "idx_wallet_tx_wallet_created";

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "providerPaymentId" SET DATA TYPE TEXT,
ALTER COLUMN "currency" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "kycVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "kyc_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "KycDocumentType" NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "faceScanUrl" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "matchScore" DOUBLE PRECISION,
    "livenessPassed" BOOLEAN,
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_userId_key" ON "kyc_verifications"("userId");

-- CreateIndex
CREATE INDEX "payments_userId_createdAt_idx" ON "payments"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "referrals_code_idx" ON "referrals"("code");

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
