-- CreateTable
CREATE TABLE "e2e_key_pairs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'RSA-OAEP-256',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "e2e_key_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encrypted_conversations" (
    "id" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encrypted_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encrypted_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "encryptedMetadata" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "encrypted_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "e2e_key_pairs_userId_key" ON "e2e_key_pairs"("userId");

-- CreateIndex
CREATE INDEX "encrypted_conversations_initiatorId_idx" ON "encrypted_conversations"("initiatorId");

-- CreateIndex
CREATE INDEX "encrypted_conversations_responderId_idx" ON "encrypted_conversations"("responderId");

-- CreateIndex
CREATE INDEX "encrypted_messages_conversationId_idx" ON "encrypted_messages"("conversationId");

-- CreateIndex
CREATE INDEX "encrypted_messages_senderId_idx" ON "encrypted_messages"("senderId");

-- AddForeignKey
ALTER TABLE "e2e_key_pairs" ADD CONSTRAINT "e2e_key_pairs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encrypted_conversations" ADD CONSTRAINT "encrypted_conversations_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encrypted_conversations" ADD CONSTRAINT "encrypted_conversations_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encrypted_messages" ADD CONSTRAINT "encrypted_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "encrypted_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encrypted_messages" ADD CONSTRAINT "encrypted_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
