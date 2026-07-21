-- CreateEnum
CREATE TYPE "SkillTestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'EVALUATED');

-- CreateTable
CREATE TABLE "skill_tests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "status" "SkillTestStatus" NOT NULL DEFAULT 'PENDING',
    "overallScore" DOUBLE PRECISION,
    "aiFeedback" TEXT,
    "modelUsed" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_test_questions" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "expectedConcepts" TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "skill_test_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_test_answers" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "skill_test_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "skill_tests_userId_createdAt_idx" ON "skill_tests"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "skill_test_questions_testId_idx" ON "skill_test_questions"("testId");

-- CreateIndex
CREATE INDEX "skill_test_answers_testId_idx" ON "skill_test_answers"("testId");

-- CreateIndex
CREATE INDEX "skill_test_answers_questionId_idx" ON "skill_test_answers"("questionId");

-- AddForeignKey
ALTER TABLE "skill_tests" ADD CONSTRAINT "skill_tests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_test_questions" ADD CONSTRAINT "skill_test_questions_testId_fkey" FOREIGN KEY ("testId") REFERENCES "skill_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_test_answers" ADD CONSTRAINT "skill_test_answers_testId_fkey" FOREIGN KEY ("testId") REFERENCES "skill_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_test_answers" ADD CONSTRAINT "skill_test_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "skill_test_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
