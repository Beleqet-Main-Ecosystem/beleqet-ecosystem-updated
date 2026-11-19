-- AlterEnum: jobs now wait for an admin before they go live.
ALTER TYPE "JobStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "JobStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewNote" TEXT;

-- Every job that was ever public went live before approval existed: count it as approved, so
-- closing and reopening it keeps working without a review.
UPDATE "jobs" SET "approvedAt" = "createdAt" WHERE "status" <> 'DRAFT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "telegramUsername" TEXT;
