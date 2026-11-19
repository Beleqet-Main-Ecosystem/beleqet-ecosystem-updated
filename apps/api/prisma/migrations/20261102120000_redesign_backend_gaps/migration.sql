-- CreateEnum
CREATE TYPE "ReportTarget" AS ENUM ('JOB', 'FORUM_THREAD', 'FORUM_REPLY');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'DISMISSED', 'ACTIONED');

-- CreateEnum
CREATE TYPE "CompanyVerificationStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeOutcome" AS ENUM ('REFUND', 'RELEASE', 'SPLIT');

-- AlterEnum
ALTER TYPE "MilestoneStatus" ADD VALUE 'PROPOSED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InterviewStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "InterviewStatus" ADD VALUE 'DECLINED';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "tradeLicenseUrl" TEXT,
ADD COLUMN     "verificationNote" TEXT,
ADD COLUMN     "verificationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "verificationStatus" "CompanyVerificationStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "disputes" ADD COLUMN     "clientAmount" INTEGER,
ADD COLUMN     "freelancerAmount" INTEGER,
ADD COLUMN     "outcome" "DisputeOutcome",
ADD COLUMN     "resolvedById" TEXT;

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN     "candidateNote" TEXT,
ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "hidden_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hidden_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_freelance_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "freelanceJobId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_freelance_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_drafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "id" TEXT NOT NULL,
    "targetType" "ReportTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hidden_jobs_userId_jobId_key" ON "hidden_jobs"("userId", "jobId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_freelance_jobs_userId_freelanceJobId_key" ON "saved_freelance_jobs"("userId", "freelanceJobId");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_drafts_userId_key" ON "portfolio_drafts"("userId");

-- CreateIndex
CREATE INDEX "content_reports_status_createdAt_idx" ON "content_reports"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_reports_targetType_targetId_reporterId_key" ON "content_reports"("targetType", "targetId", "reporterId");

-- AddForeignKey
ALTER TABLE "hidden_jobs" ADD CONSTRAINT "hidden_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hidden_jobs" ADD CONSTRAINT "hidden_jobs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_freelance_jobs" ADD CONSTRAINT "saved_freelance_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_freelance_jobs" ADD CONSTRAINT "saved_freelance_jobs_freelanceJobId_fkey" FOREIGN KEY ("freelanceJobId") REFERENCES "freelance_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_drafts" ADD CONSTRAINT "portfolio_drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Remove freelance categories left by an integration test (A31), only where no project uses them.
DELETE FROM "freelance_categories" c
WHERE c."label" = 'GDPR Test Category'
  AND c."slug" LIKE 'gdpr-test-%'
  AND NOT EXISTS (SELECT 1 FROM "freelance_jobs" j WHERE j."categoryId" = c."id");
