-- CreateEnum
CREATE TYPE "ResumeUploadStatus" AS ENUM ('PENDING', 'PARSING', 'PARSED', 'FAILED');

-- CreateTable
CREATE TABLE "resume_uploads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "status" "ResumeUploadStatus" NOT NULL DEFAULT 'PENDING',
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parsed_resumes" (
    "id" TEXT NOT NULL,
    "resumeUploadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personalInfo" JSONB NOT NULL,
    "education" JSONB NOT NULL,
    "workExperience" JSONB NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" JSONB NOT NULL,
    "extractionEngine" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parsed_resumes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resume_uploads_userId_createdAt_idx" ON "resume_uploads"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "resume_uploads_status_idx" ON "resume_uploads"("status");

-- CreateIndex
CREATE UNIQUE INDEX "parsed_resumes_resumeUploadId_key" ON "parsed_resumes"("resumeUploadId");

-- CreateIndex
CREATE INDEX "parsed_resumes_userId_createdAt_idx" ON "parsed_resumes"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "resume_uploads" ADD CONSTRAINT "resume_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parsed_resumes" ADD CONSTRAINT "parsed_resumes_resumeUploadId_fkey" FOREIGN KEY ("resumeUploadId") REFERENCES "resume_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parsed_resumes" ADD CONSTRAINT "parsed_resumes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
