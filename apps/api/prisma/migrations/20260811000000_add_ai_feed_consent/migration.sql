-- AlterTable: add aiFeedConsent column to users (idempotent)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "aiFeedConsent" BOOLEAN NOT NULL DEFAULT TRUE;
