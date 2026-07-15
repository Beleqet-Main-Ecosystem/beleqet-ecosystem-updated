-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED');

-- CreateTable: referrals (model exists in schema.prisma but no migration created it)
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT,
    "code" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "bonusAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable: job_alerts (model exists in schema.prisma but no migration created it)
CREATE TABLE "job_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keywords" TEXT[],
    "location" TEXT,
    "jobType" "JobType",
    "minSalary" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_alerts_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for Referral.code
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");

-- Indexes matching Prisma @@index annotations
CREATE INDEX "referrals_referrerId_idx" ON "referrals"("referrerId");
CREATE INDEX "referrals_status_expiresAt_idx" ON "referrals"("status", "expiresAt");
CREATE INDEX "job_alerts_userId_idx" ON "job_alerts"("userId");
CREATE INDEX "job_alerts_isActive_idx" ON "job_alerts"("isActive");

-- Foreign keys
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_alerts" ADD CONSTRAINT "job_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- DB Index Master — Strategic PostgreSQL Indexing Migration
-- Beleqet Ecosystem · Performance & Network Task
-- ============================================================
-- Strategy:
--   B-Tree  → equality / range lookups on scalar columns
--   GIN     → full-text search (tsvector), array containment
--   BRIN    → monotonically-increasing timestamps (very cheap)
--   Partial → filtered subsets (e.g. only active / published rows)
--   Composite → covers the WHERE + ORDER BY columns of hot queries
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. users
-- ─────────────────────────────────────────────────────────────

-- Fast look-up by role (frequent in admin panels / role guards)
CREATE INDEX IF NOT EXISTS "idx_users_role"
  ON "users" ("role");

-- Partial: only active users (skips deleted/banned rows)
CREATE INDEX IF NOT EXISTS "idx_users_active_email"
  ON "users" ("email")
  WHERE "isActive" = true;

-- GIN on skills array → fast containment queries (skills @> ARRAY[...])
CREATE INDEX IF NOT EXISTS "idx_users_skills_gin"
  ON "users" USING GIN ("skills");

-- Telegram ID look-up (OAuth / bot sessions)
CREATE INDEX IF NOT EXISTS "idx_users_telegram_id"
  ON "users" ("telegramId")
  WHERE "telegramId" IS NOT NULL;

-- BRIN on createdAt — huge tables, sequential writes
CREATE INDEX IF NOT EXISTS "idx_users_created_at_brin"
  ON "users" USING BRIN ("createdAt");


-- ─────────────────────────────────────────────────────────────
-- 2. jobs  (heaviest query table)
-- ─────────────────────────────────────────────────────────────

-- Full-text search: title + description combined tsvector
-- (to_tsvector is immutable so we can index it)
CREATE INDEX IF NOT EXISTS "idx_jobs_fts"
  ON "jobs" USING GIN (
    to_tsvector('english', "title" || ' ' || COALESCE("description", ''))
  );

-- GIN on tags array
CREATE INDEX IF NOT EXISTS "idx_jobs_tags_gin"
  ON "jobs" USING GIN ("tags");

-- Salary range queries: salaryMin / salaryMax B-Tree
CREATE INDEX IF NOT EXISTS "idx_jobs_salary_range"
  ON "jobs" ("salaryMin", "salaryMax")
  WHERE "salaryMin" IS NOT NULL;

-- Partial: only published jobs — most reads hit this subset
CREATE INDEX IF NOT EXISTS "idx_jobs_published"
  ON "jobs" ("categoryId", "type", "createdAt" DESC)
  WHERE "status" = 'PUBLISHED' AND "filled" = false;

-- Partial: featured + published (homepage carousel)
CREATE INDEX IF NOT EXISTS "idx_jobs_featured_published"
  ON "jobs" ("createdAt" DESC)
  WHERE "featured" = true AND "status" = 'PUBLISHED';

-- Partial: urgent jobs
CREATE INDEX IF NOT EXISTS "idx_jobs_urgent"
  ON "jobs" ("createdAt" DESC)
  WHERE "urgent" = true AND "status" = 'PUBLISHED';

-- Expiry-date pruning (cron jobs / scheduler)
CREATE INDEX IF NOT EXISTS "idx_jobs_expiry"
  ON "jobs" ("expiryDate")
  WHERE "status" = 'PUBLISHED' AND "expiryDate" IS NOT NULL;

-- BRIN on createdAt
CREATE INDEX IF NOT EXISTS "idx_jobs_created_at_brin"
  ON "jobs" USING BRIN ("createdAt");

-- Location text search
CREATE INDEX IF NOT EXISTS "idx_jobs_location_fts"
  ON "jobs" USING GIN (to_tsvector('simple', COALESCE("location", '')));


-- ─────────────────────────────────────────────────────────────
-- 3. applications
-- ─────────────────────────────────────────────────────────────

-- Employer dashboard: all apps for a job, sorted by recency
CREATE INDEX IF NOT EXISTS "idx_applications_job_status_created"
  ON "applications" ("jobId", "status", "createdAt" DESC);

-- Job seeker: my applications sorted by recency
CREATE INDEX IF NOT EXISTS "idx_applications_user_created"
  ON "applications" ("userId", "createdAt" DESC);

-- Scheduled interview look-ups
CREATE INDEX IF NOT EXISTS "idx_applications_interview_slot"
  ON "applications" ("interviewSlot")
  WHERE "interviewSlot" IS NOT NULL;

-- BRIN
CREATE INDEX IF NOT EXISTS "idx_applications_created_at_brin"
  ON "applications" USING BRIN ("createdAt");


-- ─────────────────────────────────────────────────────────────
-- 4. notifications
-- ─────────────────────────────────────────────────────────────

-- Bell-icon badge: count unread per user
CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread"
  ON "notifications" ("userId", "createdAt" DESC)
  WHERE "read" = false;

-- BRIN (high-volume, append-only)
CREATE INDEX IF NOT EXISTS "idx_notifications_created_at_brin"
  ON "notifications" USING BRIN ("createdAt");


-- ─────────────────────────────────────────────────────────────
-- 5. messages  (real-time chat, very high volume)
-- ─────────────────────────────────────────────────────────────

-- Load chat history page by page
CREATE INDEX IF NOT EXISTS "idx_messages_room_created"
  ON "messages" ("roomId", "createdAt" DESC);

-- BRIN — append-only, high cardinality
CREATE INDEX IF NOT EXISTS "idx_messages_created_at_brin"
  ON "messages" USING BRIN ("createdAt");


-- ─────────────────────────────────────────────────────────────
-- 6. freelance_jobs
-- ─────────────────────────────────────────────────────────────

-- Browse open gigs
CREATE INDEX IF NOT EXISTS "idx_freelance_jobs_open"
  ON "freelance_jobs" ("categoryId", "createdAt" DESC)
  WHERE "status" = 'OPEN';

-- GIN on skills array
CREATE INDEX IF NOT EXISTS "idx_freelance_jobs_skills_gin"
  ON "freelance_jobs" USING GIN ("skills");

-- Budget range filter
CREATE INDEX IF NOT EXISTS "idx_freelance_jobs_budget"
  ON "freelance_jobs" ("budgetMin", "budgetMax");

-- BRIN
CREATE INDEX IF NOT EXISTS "idx_freelance_jobs_created_at_brin"
  ON "freelance_jobs" USING BRIN ("createdAt");


-- ─────────────────────────────────────────────────────────────
-- 7. bids
-- ─────────────────────────────────────────────────────────────

-- Client views bids for a gig, sorted by quality score
CREATE INDEX IF NOT EXISTS "idx_bids_job_score"
  ON "bids" ("freelanceJobId", "qualityScore" DESC NULLS LAST)
  WHERE "status" = 'PENDING';


-- ─────────────────────────────────────────────────────────────
-- 8. wallet_transactions
-- ─────────────────────────────────────────────────────────────

-- Transaction history per wallet, newest first
CREATE INDEX IF NOT EXISTS "idx_wallet_tx_wallet_created"
  ON "wallet_transactions" ("walletId", "createdAt" DESC);

-- BRIN
CREATE INDEX IF NOT EXISTS "idx_wallet_tx_created_at_brin"
  ON "wallet_transactions" USING BRIN ("createdAt");


-- ─────────────────────────────────────────────────────────────
-- 9. referrals
-- ─────────────────────────────────────────────────────────────

-- Look-up by code (most common entry point)
-- Already have @@index([referralCode]) from Prisma, but make it partial
CREATE INDEX IF NOT EXISTS "idx_referrals_code_active"
  ON "referrals" ("code")
  WHERE "status" = 'PENDING';

-- Expiry sweeper
CREATE INDEX IF NOT EXISTS "idx_referrals_expires_at"
  ON "referrals" ("expiresAt")
  WHERE "status" = 'PENDING';

-- BRIN
CREATE INDEX IF NOT EXISTS "idx_referrals_created_at_brin"
  ON "referrals" USING BRIN ("createdAt");


-- ─────────────────────────────────────────────────────────────
-- 10. refresh_tokens  (security hot path)
-- ─────────────────────────────────────────────────────────────

-- Find valid tokens by value quickly
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_expires"
  ON "refresh_tokens" ("expiresAt");


-- ─────────────────────────────────────────────────────────────
-- 11. events_log  (analytics / audit trail)
-- ─────────────────────────────────────────────────────────────

-- Composite: type + entity for event sourcing replays
CREATE INDEX IF NOT EXISTS "idx_events_log_type_entity"
  ON "events_log" ("eventType", "entityType", "entityId");

-- BRIN on high-volume append-only table
CREATE INDEX IF NOT EXISTS "idx_events_log_created_at_brin"
  ON "events_log" USING BRIN ("createdAt");


-- ─────────────────────────────────────────────────────────────
-- 12. candidate_scores
-- ─────────────────────────────────────────────────────────────

-- Rank candidates for a job (join via applicationId → jobId)
CREATE INDEX IF NOT EXISTS "idx_candidate_scores_overall"
  ON "candidate_scores" ("overallScore" DESC);


-- ─────────────────────────────────────────────────────────────
-- 13. job_alerts
-- ─────────────────────────────────────────────────────────────

-- Scheduler: find active alerts due for sending
CREATE INDEX IF NOT EXISTS "idx_job_alerts_active_due"
  ON "job_alerts" ("lastSentAt" NULLS FIRST)
  WHERE "isActive" = true;


-- ─────────────────────────────────────────────────────────────
-- 14. chat_participants
-- ─────────────────────────────────────────────────────────────

-- Find all rooms a user is in
CREATE INDEX IF NOT EXISTS "idx_chat_participants_user"
  ON "chat_participants" ("userId");
