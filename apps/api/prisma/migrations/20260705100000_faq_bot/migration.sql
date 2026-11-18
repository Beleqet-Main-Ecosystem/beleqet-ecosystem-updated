-- CreateEnum
CREATE TYPE "FaqBotMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateTable
CREATE TABLE "faq_knowledge_entries" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "questionEn" TEXT NOT NULL,
    "questionAm" TEXT,
    "answerEn" TEXT NOT NULL,
    "answerAm" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currency" TEXT,
    "embedding" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_bot_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "preferredCurrency" TEXT NOT NULL DEFAULT 'ETB',
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_bot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_bot_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "FaqBotMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faq_bot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faq_knowledge_entries_slug_key" ON "faq_knowledge_entries"("slug");

-- CreateIndex
CREATE INDEX "faq_knowledge_entries_category_idx" ON "faq_knowledge_entries"("category");

-- CreateIndex
CREATE INDEX "faq_bot_sessions_userId_idx" ON "faq_bot_sessions"("userId");

-- CreateIndex
CREATE INDEX "faq_bot_sessions_anonymousId_idx" ON "faq_bot_sessions"("anonymousId");

-- CreateIndex
CREATE INDEX "faq_bot_sessions_expiresAt_idx" ON "faq_bot_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "faq_bot_messages_sessionId_createdAt_idx" ON "faq_bot_messages"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "faq_bot_messages" ADD CONSTRAINT "faq_bot_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "faq_bot_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
