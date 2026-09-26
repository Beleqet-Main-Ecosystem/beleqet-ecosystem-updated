/*
  Warnings:

  - The values [PENDING] on the enum `ResumeUploadStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `entity` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `entity_id` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `ip_address` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `new_state` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `previous_state` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `user_agent` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `audit_logs` table. All the data in the column will be lost.
  - The `status` column on the `promotion_campaigns` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[externalTransactionId]` on the table `wallet_transactions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `entityId` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityType` to the `audit_logs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'COMPLETED', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "ResumeUploadStatus_new" AS ENUM ('PARSING', 'PARSED', 'FAILED');
ALTER TABLE "resume_uploads" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "resume_uploads" ALTER COLUMN "status" TYPE "ResumeUploadStatus_new" USING ("status"::text::"ResumeUploadStatus_new");
ALTER TYPE "ResumeUploadStatus" RENAME TO "ResumeUploadStatus_old";
ALTER TYPE "ResumeUploadStatus_new" RENAME TO "ResumeUploadStatus";
DROP TYPE "ResumeUploadStatus_old";
ALTER TABLE "resume_uploads" ALTER COLUMN "status" SET DEFAULT 'PARSING';
COMMIT;

-- DropForeignKey
ALTER TABLE "parsed_resumes" DROP CONSTRAINT "parsed_resumes_userId_fkey";

-- DropForeignKey
ALTER TABLE "resume_uploads" DROP CONSTRAINT "resume_uploads_userId_fkey";

-- DropIndex
DROP INDEX "audit_logs_action_idx";

-- DropIndex
DROP INDEX "audit_logs_entity_idx";

-- DropIndex
DROP INDEX "audit_logs_timestamp_idx";

-- DropIndex
DROP INDEX "audit_logs_user_id_timestamp_idx";

-- DropIndex
DROP INDEX "parsed_resumes_userId_createdAt_idx";

-- DropIndex
DROP INDEX "resume_uploads_status_idx";

-- DropIndex
DROP INDEX "resume_uploads_userId_createdAt_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "entity",
DROP COLUMN "entity_id",
DROP COLUMN "ip_address",
DROP COLUMN "new_state",
DROP COLUMN "previous_state",
DROP COLUMN "timestamp",
DROP COLUMN "user_agent",
DROP COLUMN "user_id",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "entityId" TEXT NOT NULL,
ADD COLUMN     "entityType" TEXT NOT NULL,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "newState" JSONB,
ADD COLUMN     "previousState" JSONB,
ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "promotion_campaigns" DROP COLUMN "status",
ADD COLUMN     "status" "CampaignStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "resume_uploads" ALTER COLUMN "status" SET DEFAULT 'PARSING';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "externalCustomerId" TEXT,
ADD COLUMN     "externalSubscriptionId" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT;

-- AlterTable
ALTER TABLE "wallet_transactions" ADD COLUMN     "externalTransactionId" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "status" TEXT;

-- DropEnum
DROP TYPE "PromotionCampaignStatus";

-- CreateTable
CREATE TABLE "forum_threads" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userId" TEXT NOT NULL,
    "userDisplayName" TEXT NOT NULL DEFAULT 'Deleted User',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_replies" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "parentReplyId" TEXT,
    "userId" TEXT NOT NULL,
    "userDisplayName" TEXT NOT NULL DEFAULT 'Deleted User',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "upvoteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forum_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_upvotes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT,
    "replyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_upvotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suppressions" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 202,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestBody" JSONB NOT NULL,
    "responseBody" JSONB,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "retryUntil" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "externalTransactionId" TEXT NOT NULL,
    "externalCustomerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gdpr_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "purpose" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gdpr_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forum_threads_userId_idx" ON "forum_threads"("userId");

-- CreateIndex
CREATE INDEX "forum_threads_createdAt_idx" ON "forum_threads"("createdAt");

-- CreateIndex
CREATE INDEX "forum_threads_upvoteCount_idx" ON "forum_threads"("upvoteCount");

-- CreateIndex
CREATE INDEX "forum_replies_threadId_createdAt_idx" ON "forum_replies"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "forum_replies_userId_idx" ON "forum_replies"("userId");

-- CreateIndex
CREATE INDEX "forum_upvotes_threadId_idx" ON "forum_upvotes"("threadId");

-- CreateIndex
CREATE INDEX "forum_upvotes_replyId_idx" ON "forum_upvotes"("replyId");

-- CreateIndex
CREATE UNIQUE INDEX "forum_upvotes_userId_threadId_key" ON "forum_upvotes"("userId", "threadId");

-- CreateIndex
CREATE UNIQUE INDEX "forum_upvotes_userId_replyId_key" ON "forum_upvotes"("userId", "replyId");

-- CreateIndex
CREATE UNIQUE INDEX "email_suppressions_recipient_key" ON "email_suppressions"("recipient");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_logs_idempotencyKey_key" ON "webhook_logs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "webhook_logs_provider_eventType_idx" ON "webhook_logs"("provider", "eventType");

-- CreateIndex
CREATE INDEX "webhook_logs_idempotencyKey_idx" ON "webhook_logs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "webhook_logs_createdAt_idx" ON "webhook_logs"("createdAt");

-- CreateIndex
CREATE INDEX "webhook_logs_processedAt_idx" ON "webhook_logs"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_externalTransactionId_key" ON "payment_transactions"("externalTransactionId");

-- CreateIndex
CREATE INDEX "payment_transactions_externalTransactionId_idx" ON "payment_transactions"("externalTransactionId");

-- CreateIndex
CREATE INDEX "payment_transactions_externalCustomerId_idx" ON "payment_transactions"("externalCustomerId");

-- CreateIndex
CREATE INDEX "payment_transactions_provider_status_idx" ON "payment_transactions"("provider", "status");

-- CreateIndex
CREATE INDEX "payment_transactions_createdAt_idx" ON "payment_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "gdpr_consents_purpose_idx" ON "gdpr_consents"("purpose");

-- CreateIndex
CREATE INDEX "gdpr_consents_userId_idx" ON "gdpr_consents"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "parsed_resumes_userId_idx" ON "parsed_resumes"("userId");

-- CreateIndex
CREATE INDEX "promotion_campaigns_targetType_targetId_status_idx" ON "promotion_campaigns"("targetType", "targetId", "status");

-- CreateIndex
CREATE INDEX "promotion_campaigns_ownerId_status_idx" ON "promotion_campaigns"("ownerId", "status");

-- CreateIndex
CREATE INDEX "resume_uploads_userId_idx" ON "resume_uploads"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_externalTransactionId_key" ON "wallet_transactions"("externalTransactionId");

-- CreateIndex
CREATE INDEX "wallet_transactions_externalTransactionId_idx" ON "wallet_transactions"("externalTransactionId");

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_parentReplyId_fkey" FOREIGN KEY ("parentReplyId") REFERENCES "forum_replies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_replies" ADD CONSTRAINT "forum_replies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_upvotes" ADD CONSTRAINT "forum_upvotes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_upvotes" ADD CONSTRAINT "forum_upvotes_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "forum_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_upvotes" ADD CONSTRAINT "forum_upvotes_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "forum_replies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
