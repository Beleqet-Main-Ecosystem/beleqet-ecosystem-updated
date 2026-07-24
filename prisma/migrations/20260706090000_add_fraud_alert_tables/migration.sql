-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FraudSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FraudAlertStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'FALSE_POSITIVE', 'CONFIRMED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FraudRuleType" AS ENUM ('OFF_PLATFORM_PAYMENT', 'FAKE_PROFILE', 'PAYMENT_ANOMALY', 'DUPLICATE_LISTING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "fraud_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruleType" "FraudRuleType" NOT NULL,
    "severity" "FraudSeverity" NOT NULL DEFAULT 'MEDIUM',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "i18nKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable (base columns only; GDPR fields added in 20260706100000)
CREATE TABLE IF NOT EXISTS "fraud_alerts" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "ruleId" TEXT,
    "ruleType" "FraudRuleType" NOT NULL,
    "severity" "FraudSeverity" NOT NULL DEFAULT 'MEDIUM',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "status" "FraudAlertStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fraud_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fraud_rules_ruleType_enabled_idx" ON "fraud_rules"("ruleType", "enabled");
CREATE INDEX IF NOT EXISTS "fraud_alerts_entityType_entityId_idx" ON "fraud_alerts"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "fraud_alerts_severity_status_idx" ON "fraud_alerts"("severity", "status");
CREATE INDEX IF NOT EXISTS "fraud_alerts_userId_createdAt_idx" ON "fraud_alerts"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "fraud_alerts_ruleType_idx" ON "fraud_alerts"("ruleType");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fraud_alerts" ADD CONSTRAINT "fraud_alerts_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "fraud_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
