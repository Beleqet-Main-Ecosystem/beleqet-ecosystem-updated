-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "interviewDurationMinutes" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "user_availability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "meetingLink" TEXT,
    "notes" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_availability_userId_idx" ON "user_availability"("userId");

-- CreateIndex
CREATE INDEX "user_availability_startTime_endTime_idx" ON "user_availability"("startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_applicationId_key" ON "interviews"("applicationId");

-- CreateIndex
CREATE INDEX "interviews_candidateId_startTime_idx" ON "interviews"("candidateId", "startTime");

-- CreateIndex
CREATE INDEX "interviews_employerId_startTime_idx" ON "interviews"("employerId", "startTime");

-- CreateIndex
CREATE INDEX "interviews_employerId_idx" ON "interviews"("employerId");

-- CreateIndex
CREATE INDEX "interviews_candidateId_idx" ON "interviews"("candidateId");

-- CreateIndex
CREATE INDEX "interviews_startTime_idx" ON "interviews"("startTime");

-- AddForeignKey
ALTER TABLE "user_availability" ADD CONSTRAINT "user_availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
