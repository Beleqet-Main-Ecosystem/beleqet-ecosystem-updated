-- Until November 2026 a global interceptor wrote almost every web request into the audit trail
-- (events_log): about 600,000 HTTP_REQUEST rows, 340 MB of a 413 MB database. The audit trail keeps
-- business events only; nginx keeps the request logs. This removes those rows once.
--
-- events_log is append-only (trg_events_log_no_delete, see 20260718164310_audit_log_immutability).
-- The guard is lifted for this one DELETE and restored in the same statement: a DO block runs as a
-- single statement, so if anything in it fails, all of it is undone, the guard included.
DO $$
BEGIN
  ALTER TABLE events_log DISABLE TRIGGER trg_events_log_no_delete;
  DELETE FROM events_log WHERE "eventType" = 'HTTP_REQUEST' AND "entityType" = 'HttpRequest';
  ALTER TABLE events_log ENABLE TRIGGER trg_events_log_no_delete;
END $$;
