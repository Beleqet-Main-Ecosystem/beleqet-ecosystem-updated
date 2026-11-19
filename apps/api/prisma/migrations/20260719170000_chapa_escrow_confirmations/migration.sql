ALTER TABLE "milestones"
  ADD COLUMN "employerApprovedAt" TIMESTAMP(3),
  ADD COLUMN "freelancerApprovedAt" TIMESTAMP(3);

CREATE INDEX "events_log_eventType_entityId_createdAt_idx"
  ON "events_log"("eventType", "entityId", "createdAt");
