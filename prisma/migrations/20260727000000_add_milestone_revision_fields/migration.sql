-- AlterTable
ALTER TABLE "milestones" ADD COLUMN "revisionNotes" TEXT,
ADD COLUMN "revisionCount" INTEGER NOT NULL DEFAULT 0;
