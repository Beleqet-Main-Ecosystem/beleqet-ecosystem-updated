-- DropIndex
DROP INDEX "idx_events_log_created_at";

-- CreateIndex
CREATE INDEX "idx_events_log_created_at" ON "events_log"("createdAt");
