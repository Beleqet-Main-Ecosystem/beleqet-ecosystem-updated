/*
  Warnings:

  - You are about to drop the `audit_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "audit_logs";

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

-- CreateTable
CREATE TABLE "freelance_match_scores" (
    "id" TEXT NOT NULL,
    "freelanceJobId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "skillScore" INTEGER NOT NULL,
    "locationScore" INTEGER NOT NULL,
    "experienceScore" INTEGER NOT NULL,
    "algorithmVersion" TEXT NOT NULL DEFAULT 'v1',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelance_match_scores_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "freelance_match_scores_freelanceJobId_overallScore_idx" ON "freelance_match_scores"("freelanceJobId", "overallScore");

-- CreateIndex
CREATE INDEX "freelance_match_scores_freelancerId_overallScore_idx" ON "freelance_match_scores"("freelancerId", "overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "freelance_match_scores_freelanceJobId_freelancerId_key" ON "freelance_match_scores"("freelanceJobId", "freelancerId");

-- AddForeignKey
ALTER TABLE "freelance_match_scores" ADD CONSTRAINT "freelance_match_scores_freelanceJobId_fkey" FOREIGN KEY ("freelanceJobId") REFERENCES "freelance_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelance_match_scores" ADD CONSTRAINT "freelance_match_scores_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
