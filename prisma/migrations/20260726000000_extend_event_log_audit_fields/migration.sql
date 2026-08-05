-- AlterTable: extend events_log for HTTP / actor audit metadata
ALTER TABLE "events_log" ADD COLUMN IF NOT EXISTS "actorUserId" TEXT;
ALTER TABLE "events_log" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "events_log" ADD COLUMN IF NOT EXISTS "httpMethod" TEXT;
ALTER TABLE "events_log" ADD COLUMN IF NOT EXISTS "path" TEXT;
ALTER TABLE "events_log" ADD COLUMN IF NOT EXISTS "statusCode" INTEGER;
ALTER TABLE "events_log" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "events_log_createdAt_idx" ON "events_log"("createdAt");
CREATE INDEX IF NOT EXISTS "events_log_actorUserId_createdAt_idx" ON "events_log"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "events_log_path_createdAt_idx" ON "events_log"("path", "createdAt");
