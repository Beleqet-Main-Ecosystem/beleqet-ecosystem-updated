-- Close the TRUNCATE loophole in the events_log immutability guard.
--
-- The existing trg_events_log_no_update / trg_events_log_no_delete triggers
-- (see 20260718164310_audit_log_immutability) are ROW-level triggers
-- (`FOR EACH ROW`), which only fire once per affected row. TRUNCATE does not
-- delete rows individually — it deallocates the table's storage directly —
-- so row-level BEFORE DELETE triggers never fire for it, letting anyone with
-- TRUNCATE privilege silently wipe the entire audit trail.
--
-- TRUNCATE only supports STATEMENT-level triggers, so this reuses the same
-- prevent_events_log_mutation() function (which already keys its error
-- message off TG_OP, so it correctly reports "TRUNCATE" here) via a
-- separate FOR EACH STATEMENT trigger.

DROP TRIGGER IF EXISTS trg_events_log_no_truncate ON events_log;
CREATE TRIGGER trg_events_log_no_truncate
  BEFORE TRUNCATE ON events_log
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_events_log_mutation();
