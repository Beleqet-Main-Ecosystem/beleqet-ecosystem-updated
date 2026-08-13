-- Add the user-level subscription columns expected by the current schema.
-- Older database instances can be missing these fields even though the app code
-- and Prisma schema rely on them for subscriptions and onboarding flows.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
  END IF;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "externalCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus" DEFAULT 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "users_externalCustomerId_key"
  ON "users"("externalCustomerId");

CREATE UNIQUE INDEX IF NOT EXISTS "users_externalSubscriptionId_key"
  ON "users"("externalSubscriptionId");
