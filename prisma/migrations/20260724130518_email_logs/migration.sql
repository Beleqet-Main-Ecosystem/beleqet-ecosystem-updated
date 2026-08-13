-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('WELCOME', 'PASSWORD_RESET', 'PAYMENT_RECEIPT', 'NEWSLETTER');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'BOUNCED');

-- DropIndex
DROP INDEX IF EXISTS "interview_evaluations_rawAiResponse_gin_idx";

-- DropIndex
DROP INDEX IF EXISTS "interview_evaluations_scores_gin_idx";

-- DropIndex
DROP INDEX IF EXISTS "video_interviews_metadata_gin_idx";

-- DropIndex
DROP INDEX IF EXISTS "video_responses_rawWhisperResponse_gin_idx";

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "type" "EmailType" NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "templateName" TEXT NOT NULL,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "provider" TEXT,
    "providerMsgId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_type_idx" ON "email_logs"("type");

-- CreateIndex
CREATE INDEX "email_logs_recipient_idx" ON "email_logs"("recipient");

-- CreateIndex
CREATE INDEX "email_logs_createdAt_idx" ON "email_logs"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "interview_evaluations_scores_idx" ON "interview_evaluations" USING GIN ("scores");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "interview_evaluations_rawAiResponse_idx" ON "interview_evaluations" USING GIN ("rawAiResponse");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "video_interviews_metadata_idx" ON "video_interviews" USING GIN ("metadata");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "video_responses_rawWhisperResponse_idx" ON "video_responses" USING GIN ("rawWhisperResponse");

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
