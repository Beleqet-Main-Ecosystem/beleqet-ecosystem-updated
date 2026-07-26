-- CreateEnum
CREATE TYPE "VideoInterviewStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable: video_interviews
-- metadata JSONB stores question config; GIN index enables fast JSONB path queries.
CREATE TABLE "video_interviews" (
    "id"            TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "status"        "VideoInterviewStatus" NOT NULL DEFAULT 'PENDING',
    "metadata"      JSONB NOT NULL,
    "scheduledAt"   TIMESTAMP(3),
    "expiresAt"     TIMESTAMP(3),
    "gdprDeleteAt"  TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable: video_responses
-- rawWhisperResponse JSONB stores full Whisper payload; GIN enables segment/language queries.
CREATE TABLE "video_responses" (
    "id"                   TEXT NOT NULL,
    "videoInterviewId"     TEXT NOT NULL,
    "questionIndex"        INTEGER NOT NULL,
    "videoUrl"             TEXT,
    "transcript"           TEXT,
    "rawWhisperResponse"   JSONB,
    "processingDurationMs" INTEGER,
    "language"             TEXT NOT NULL DEFAULT 'en',
    "processingStatus"     TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: interview_evaluations
-- scores JSONB holds per-question and trait scores; GIN enables trait/score range queries.
CREATE TABLE "interview_evaluations" (
    "id"               TEXT NOT NULL,
    "videoInterviewId" TEXT NOT NULL,
    "overallScore"     DOUBLE PRECISION NOT NULL,
    "scores"           JSONB NOT NULL,
    "reasoning"        TEXT,
    "rawAiResponse"    JSONB,
    "modelUsed"        TEXT NOT NULL DEFAULT 'llama3',
    "gdprDeleteAt"     TIMESTAMP(3) NOT NULL,
    "evaluatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_evaluations_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "video_interviews"     ADD CONSTRAINT "video_interviews_applicationId_key"           UNIQUE ("applicationId");
ALTER TABLE "video_responses"      ADD CONSTRAINT "video_responses_videoInterviewId_questionIndex_key" UNIQUE ("videoInterviewId", "questionIndex");
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_videoInterviewId_key"  UNIQUE ("videoInterviewId");

-- Standard B-tree indexes
CREATE INDEX "video_interviews_userId_status_idx"    ON "video_interviews" ("userId", "status");
CREATE INDEX "video_interviews_status_expiresAt_idx" ON "video_interviews" ("status", "expiresAt");
CREATE INDEX "video_responses_videoInterviewId_questionIndex_idx" ON "video_responses" ("videoInterviewId", "questionIndex");

-- GIN indexes for JSONB columns — enables fast @>, @?, jsonpath queries
-- metadata: query by question config, locale, jobTitle
CREATE INDEX "video_interviews_metadata_gin_idx"
    ON "video_interviews" USING GIN ("metadata" jsonb_path_ops);

-- rawWhisperResponse: query by language, word timestamps, confidence segments
CREATE INDEX "video_responses_rawWhisperResponse_gin_idx"
    ON "video_responses" USING GIN ("rawWhisperResponse" jsonb_path_ops);

-- scores: query by trait scores, per-question feedback
CREATE INDEX "interview_evaluations_scores_gin_idx"
    ON "interview_evaluations" USING GIN ("scores" jsonb_path_ops);

-- rawAiResponse: audit queries on raw model output
CREATE INDEX "interview_evaluations_rawAiResponse_gin_idx"
    ON "interview_evaluations" USING GIN ("rawAiResponse" jsonb_path_ops);

-- Foreign key constraints
ALTER TABLE "video_interviews"
    ADD CONSTRAINT "video_interviews_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "video_interviews"
    ADD CONSTRAINT "video_interviews_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "video_responses"
    ADD CONSTRAINT "video_responses_videoInterviewId_fkey"
    FOREIGN KEY ("videoInterviewId") REFERENCES "video_interviews"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "interview_evaluations"
    ADD CONSTRAINT "interview_evaluations_videoInterviewId_fkey"
    FOREIGN KEY ("videoInterviewId") REFERENCES "video_interviews"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
