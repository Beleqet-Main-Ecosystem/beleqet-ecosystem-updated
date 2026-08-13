-- Add the GDPR consent lifecycle columns expected by the current schema.
-- These are referenced by GDPR workflows and webhook logic, but they were
-- missing from the older migration chain that shipped with the app.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "gdprConsentDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "gdprConsentRevoked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "gdprConsentRevokedAt" TIMESTAMP(3);
