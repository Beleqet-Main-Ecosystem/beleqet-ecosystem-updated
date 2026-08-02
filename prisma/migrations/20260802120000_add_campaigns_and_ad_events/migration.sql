-- Campaign / Ads (boost) — Phase 1
-- campaigns: mutable lifecycle via status (never hard-delete)
-- ad_events: append-only immutable telemetry
--
-- SCALE NOTE: ad_events will grow quickly. Shipping Postgres-only for MVP dashboards;
-- evaluate TimescaleDB / ClickHouse (or partitioned tables + rollup aggregates) before
-- high-QPS reporting. See docs/campaigns-data-model.md.

-- CreateEnum
CREATE TYPE "CampaignTargetType" AS ENUM ('JOB', 'PROPOSAL', 'GIG');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignBidModel" AS ENUM ('CPC', 'CPM');

-- CreateEnum
CREATE TYPE "AdEventType" AS ENUM ('IMPRESSION', 'CLICK', 'CONVERSION');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "targetType" "CampaignTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "bidModel" "CampaignBidModel" NOT NULL,
    "bidAmount" INTEGER NOT NULL,
    "dailyBudgetCap" INTEGER NOT NULL,
    "totalBudget" INTEGER NOT NULL,
    "spentAmount" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'ETB',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_events" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "eventType" "AdEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hashedIp" TEXT,
    "hashedUserAgent" TEXT,
    "sessionRef" TEXT,

    CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_ownerId_status_idx" ON "campaigns"("ownerId", "status");

-- CreateIndex
CREATE INDEX "campaigns_targetType_targetId_idx" ON "campaigns"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "campaigns_status_startAt_endAt_idx" ON "campaigns"("status", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "ad_events_campaignId_eventType_occurredAt_idx" ON "ad_events"("campaignId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "ad_events_occurredAt_idx" ON "ad_events"("occurredAt");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
