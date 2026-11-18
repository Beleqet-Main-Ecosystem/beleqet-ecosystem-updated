-- Enforce immutability on events_log (the audit trail table).
-- No application code path — not even a superuser mistake — can silently
-- edit or delete a historical audit entry once written.

CREATE OR REPLACE FUNCTION prevent_events_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'events_log is append-only: % operations are not permitted (audit trail immutability)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_log_no_update ON events_log;
CREATE TRIGGER trg_events_log_no_update
  BEFORE UPDATE ON events_log
  FOR EACH ROW EXECUTE FUNCTION prevent_events_log_mutation();

DROP TRIGGER IF EXISTS trg_events_log_no_delete ON events_log;
CREATE TRIGGER trg_events_log_no_delete
  BEFORE DELETE ON events_log
  FOR EACH ROW EXECUTE FUNCTION prevent_events_log_mutation();

-- Supporting indexes for the admin dashboard's date-range + entity-type filters.
CREATE INDEX IF NOT EXISTS idx_events_log_created_at ON events_log ("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_events_log_entity_type ON events_log ("entityType");
