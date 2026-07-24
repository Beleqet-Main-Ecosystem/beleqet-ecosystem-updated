-- DropIndex
DROP INDEX "interview_evaluations_rawAiResponse_gin_idx";

-- DropIndex
DROP INDEX "interview_evaluations_scores_gin_idx";

-- DropIndex
DROP INDEX "video_interviews_metadata_gin_idx";

-- DropIndex
DROP INDEX "video_responses_rawWhisperResponse_gin_idx";

-- CreateIndex
CREATE INDEX "interview_evaluations_scores_idx" ON "interview_evaluations" USING GIN ("scores");

-- CreateIndex
CREATE INDEX "interview_evaluations_rawAiResponse_idx" ON "interview_evaluations" USING GIN ("rawAiResponse");

-- CreateIndex
CREATE INDEX "video_interviews_metadata_idx" ON "video_interviews" USING GIN ("metadata");

-- CreateIndex
CREATE INDEX "video_responses_rawWhisperResponse_idx" ON "video_responses" USING GIN ("rawWhisperResponse");
