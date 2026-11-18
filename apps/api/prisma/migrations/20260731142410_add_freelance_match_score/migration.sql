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
CREATE INDEX "freelance_match_scores_freelanceJobId_overallScore_idx" ON "freelance_match_scores"("freelanceJobId", "overallScore");

-- CreateIndex
CREATE INDEX "freelance_match_scores_freelancerId_overallScore_idx" ON "freelance_match_scores"("freelancerId", "overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "freelance_match_scores_freelanceJobId_freelancerId_key" ON "freelance_match_scores"("freelanceJobId", "freelancerId");

-- AddForeignKey
ALTER TABLE "freelance_match_scores" ADD CONSTRAINT "freelance_match_scores_freelanceJobId_fkey" FOREIGN KEY ("freelanceJobId") REFERENCES "freelance_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freelance_match_scores" ADD CONSTRAINT "freelance_match_scores_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;