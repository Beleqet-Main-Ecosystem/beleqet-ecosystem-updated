-- CreateTable
CREATE TABLE "user_two_factor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "encryptionKeyVersion" TEXT NOT NULL DEFAULT 'v1',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enrollmentToken" TEXT,
    "enrollmentExpiresAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_codes" (
    "id" TEXT NOT NULL,
    "twoFactorId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_two_factor_userId_key" ON "user_two_factor"("userId");

-- CreateIndex
CREATE INDEX "backup_codes_twoFactorId_idx" ON "backup_codes"("twoFactorId");

-- AddForeignKey
ALTER TABLE "user_two_factor" ADD CONSTRAINT "user_two_factor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_codes" ADD CONSTRAINT "backup_codes_twoFactorId_fkey" FOREIGN KEY ("twoFactorId") REFERENCES "user_two_factor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
