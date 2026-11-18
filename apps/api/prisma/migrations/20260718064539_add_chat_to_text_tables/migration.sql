-- CreateEnum
CREATE TYPE "SpeechTranscriptStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SpeechMessageType" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'NOTIFICATION');

-- CreateTable
CREATE TABLE "speech_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speech_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speech_transcripts" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "audioUrl" TEXT,
    "videoUrl" TEXT,
    "duration" INTEGER,
    "rawText" TEXT,
    "normalizedText" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "confidence" DOUBLE PRECISION,
    "provider" TEXT,
    "processingTime" INTEGER,
    "status" "SpeechTranscriptStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speech_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speech_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "transcriptId" TEXT,
    "content" TEXT NOT NULL,
    "type" "SpeechMessageType" NOT NULL DEFAULT 'USER',
    "sender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speech_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "speech_conversations_userId_createdAt_idx" ON "speech_conversations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "speech_transcripts_conversationId_createdAt_idx" ON "speech_transcripts"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "speech_transcripts_status_idx" ON "speech_transcripts"("status");

-- CreateIndex
CREATE INDEX "speech_messages_conversationId_createdAt_idx" ON "speech_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "speech_messages_transcriptId_idx" ON "speech_messages"("transcriptId");

-- AddForeignKey
ALTER TABLE "speech_conversations" ADD CONSTRAINT "speech_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speech_transcripts" ADD CONSTRAINT "speech_transcripts_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "speech_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speech_messages" ADD CONSTRAINT "speech_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "speech_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speech_messages" ADD CONSTRAINT "speech_messages_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "speech_transcripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
