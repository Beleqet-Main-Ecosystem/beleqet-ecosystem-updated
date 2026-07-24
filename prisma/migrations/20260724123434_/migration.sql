-- DropIndex
DROP INDEX "interview_evaluations_rawAiResponse_gin_idx";

-- DropIndex
DROP INDEX "interview_evaluations_scores_gin_idx";

-- DropIndex
DROP INDEX "video_interviews_metadata_gin_idx";

-- DropIndex
DROP INDEX "video_responses_rawWhisperResponse_gin_idx";

-- CreateTable
CREATE TABLE "salary_predictions" (
    "id" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobCategoryId" TEXT,
    "industry" TEXT,
    "location" TEXT NOT NULL,
    "experienceLevel" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "minSalary" INTEGER NOT NULL,
    "maxSalary" INTEGER NOT NULL,
    "averageSalary" INTEGER NOT NULL,
    "medianSalary" INTEGER NOT NULL,
    "dataPointsCount" INTEGER NOT NULL DEFAULT 0,
    "standardDeviation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAnonymized" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "salary_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_history" (
    "id" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobCategoryId" TEXT,
    "industry" TEXT,
    "location" TEXT NOT NULL,
    "experienceLevel" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "minSalary" INTEGER NOT NULL,
    "maxSalary" INTEGER NOT NULL,
    "averageSalary" INTEGER NOT NULL,
    "medianSalary" INTEGER NOT NULL,
    "dataPointsCount" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isAnonymized" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "salary_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_analytics" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "industry" TEXT,
    "jobCategoryId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "averageSalary" INTEGER NOT NULL,
    "medianSalary" INTEGER NOT NULL,
    "salaryGrowthRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topJobTitles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "periodStartDate" TIMESTAMP(3) NOT NULL,
    "periodEndDate" TIMESTAMP(3) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_predictions_jobTitle_location_experienceLevel_idx" ON "salary_predictions"("jobTitle", "location", "experienceLevel");

-- CreateIndex
CREATE INDEX "salary_predictions_jobCategoryId_location_idx" ON "salary_predictions"("jobCategoryId", "location");

-- CreateIndex
CREATE INDEX "salary_predictions_location_industry_idx" ON "salary_predictions"("location", "industry");

-- CreateIndex
CREATE INDEX "salary_predictions_lastUpdatedAt_idx" ON "salary_predictions"("lastUpdatedAt");

-- CreateIndex
CREATE INDEX "salary_history_jobTitle_location_idx" ON "salary_history"("jobTitle", "location");

-- CreateIndex
CREATE INDEX "salary_history_recordedAt_location_idx" ON "salary_history"("recordedAt", "location");

-- CreateIndex
CREATE INDEX "salary_analytics_location_industry_idx" ON "salary_analytics"("location", "industry");

-- CreateIndex
CREATE INDEX "salary_analytics_periodEndDate_idx" ON "salary_analytics"("periodEndDate");

-- CreateIndex
CREATE INDEX "interview_evaluations_scores_idx" ON "interview_evaluations" USING GIN ("scores");

-- CreateIndex
CREATE INDEX "interview_evaluations_rawAiResponse_idx" ON "interview_evaluations" USING GIN ("rawAiResponse");

-- CreateIndex
CREATE INDEX "video_interviews_metadata_idx" ON "video_interviews" USING GIN ("metadata");

-- CreateIndex
CREATE INDEX "video_responses_rawWhisperResponse_idx" ON "video_responses" USING GIN ("rawWhisperResponse");
