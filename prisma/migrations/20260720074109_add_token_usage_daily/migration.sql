-- CreateTable: token_usage_daily
CREATE TABLE "token_usage_daily" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "token_usage_daily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "token_usage_daily_date_key" ON "token_usage_daily"("date");
CREATE INDEX "token_usage_daily_date_idx" ON "token_usage_daily"("date");
