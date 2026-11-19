-- AlterTable
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_lastLoginAt_idx" ON "users"("lastLoginAt");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");
