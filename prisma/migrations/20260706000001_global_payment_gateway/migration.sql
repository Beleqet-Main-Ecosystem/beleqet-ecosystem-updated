-- ============================================================================
-- Migration: 20260706000001_global_payment_gateway
-- Task IDs:  Global-Payments-001 (Stripe) & Global-Payments-002 (PayPal)
-- Description:
--   Creates the `payments` table and supporting enums for the Beleqet
--   Global Payment Gateway module.
--
-- GDPR notes:
--   - No PII columns — userId is a UUID FK, metadata is pre-sanitised.
--   - ON DELETE CASCADE ensures user data is removed with user account.
-- ============================================================================

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "PaymentProvider" AS ENUM (
  'STRIPE',
  'PAYPAL'
);

CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'CANCELLED'
);

-- ─── payments table ──────────────────────────────────────────────────────────

CREATE TABLE "payments" (
  "id"                  UUID              NOT NULL DEFAULT gen_random_uuid(),
  "userId"              UUID              NOT NULL,
  "provider"            "PaymentProvider" NOT NULL,
  "providerPaymentId"   VARCHAR(255)      NOT NULL,
  "amount"              INTEGER           NOT NULL,
  "currency"            VARCHAR(3)        NOT NULL DEFAULT 'USD',
  "status"              "PaymentStatus"   NOT NULL DEFAULT 'PENDING',
  "description"         TEXT,
  "metadata"            JSONB,
  "refundedAt"          TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payments_pkey"                    PRIMARY KEY ("id"),
  CONSTRAINT "payments_providerPaymentId_key"   UNIQUE ("providerPaymentId"),
  CONSTRAINT "payments_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "users" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX "payments_userId_createdAt_idx"
  ON "payments" ("userId", "createdAt" DESC);

CREATE INDEX "payments_providerPaymentId_idx"
  ON "payments" ("providerPaymentId");

CREATE INDEX "payments_status_provider_idx"
  ON "payments" ("status", "provider");

CREATE INDEX "payments_currency_status_idx"
  ON "payments" ("currency", "status");
