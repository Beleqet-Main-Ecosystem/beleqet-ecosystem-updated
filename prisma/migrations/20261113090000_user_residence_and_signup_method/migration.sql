-- How each account was created, and where its owner lives.
CREATE TYPE "SignupMethod" AS ENUM ('EMAIL', 'TELEGRAM_BOT', 'TELEGRAM', 'GOOGLE', 'LINKEDIN');

ALTER TABLE "users"
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "signupMethod" "SignupMethod" NOT NULL DEFAULT 'EMAIL';

-- Existing accounts, as closely as the data allows.
-- Created by Google or LinkedIn: the provider was linked within a minute of the account.
UPDATE "users" u SET "signupMethod" = oa."provider"::text::"SignupMethod"
FROM (
  SELECT DISTINCT ON ("userId") "userId", "provider", "linkedAt"
  FROM "oauth_accounts" ORDER BY "userId", "linkedAt"
) oa
WHERE oa."userId" = u."id" AND oa."linkedAt" <= u."createdAt" + INTERVAL '1 minute';

-- Telegram sign-in on the website made these placeholder addresses.
UPDATE "users" SET "signupMethod" = 'TELEGRAM'
WHERE "email" LIKE 'tma\_%@tme.beleqet.local';

-- The bot (and the WordPress bot before it) is the only other way a Telegram id got attached.
UPDATE "users" SET "signupMethod" = 'TELEGRAM_BOT'
WHERE "telegramId" IS NOT NULL AND "signupMethod" = 'EMAIL';
