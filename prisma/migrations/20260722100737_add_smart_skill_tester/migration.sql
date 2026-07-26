-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('ENTRY', 'MID', 'SENIOR');

-- CreateTable
CREATE TABLE "skill_assessment_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobRole" TEXT NOT NULL,
    "skillLevel" "SkillLevel" NOT NULL,
    "score" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_assessment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "candidateAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skill_assessment_sessions_userId_createdAt_idx" ON "skill_assessment_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "assessment_questions_sessionId_idx" ON "assessment_questions"("sessionId");

-- AddForeignKey
ALTER TABLE "skill_assessment_sessions" ADD CONSTRAINT "skill_assessment_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "skill_assessment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
