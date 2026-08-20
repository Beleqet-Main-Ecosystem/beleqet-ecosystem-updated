-- Add GDPR consent tracking fields to users table.
-- gdprConsent already exists (added in 20260714150000_add_gdpr_consent_and_search_history).
-- This migration adds the three additional columns that the Prisma schema declares
-- but that were never materialized in the database.

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "gdprConsentDate"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "gdprConsentRevoked"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "gdprConsentRevokedAt" TIMESTAMP(3);
