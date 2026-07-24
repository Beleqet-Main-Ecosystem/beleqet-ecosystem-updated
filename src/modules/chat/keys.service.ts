import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from './encryption.service';

/**
 * Service to manage User E2EE Public Keys.
 */
@Injectable()
export class KeysService {
  private readonly logger = new Logger(KeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService
  ) {}

  /**
   * Registers or updates the E2EE public key for a user.
   * @param userId Unique identifier of the user
   * @param publicKey Base64 encoded public key string
   */
  async registerKey(userId: string, publicKey: string) {
    this.logger.log(`Registering public key for user: ${userId}`);
    const encryptedKey = this.encryptionService.encrypt(publicKey);
    
    const record = await this.prisma.userPublicKey.upsert({
      where: { userId },
      update: { publicKey: encryptedKey },
      create: { userId, publicKey: encryptedKey },
    });
        // Do NOT expose the plaintext public key – the client already knows it.
        return { id: record.id, userId: record.userId, publicKey: null, createdAt: record.createdAt, updatedAt: record.updatedAt };
  }

  /**
   * Retrieves the E2EE public key for a user.
   * @param userId Unique identifier of the user
   */
  async getKey(userId: string) {
    const keyRecord = await this.prisma.userPublicKey.findUnique({
      where: { userId },
    });
    if (!keyRecord) {
      throw new NotFoundException(`No public key registered for user: ${userId}`);
    }

    // Decrypt the public key before sending to requesting client
    const decryptedKey = this.encryptionService.decrypt(keyRecord.publicKey);
    return { ...keyRecord, publicKey: decryptedKey };
  }

  /**
   * Deletes the E2EE public key for a user (GDPR Right to Erasure / Reset).
   * @param userId Unique identifier of the user
   */
  async deleteKey(userId: string) {
    this.logger.log(`Deleting public key for user: ${userId} (GDPR Erasure)`);
    try {
      return await this.prisma.userPublicKey.delete({
        where: { userId },
      });
    } catch {
      throw new NotFoundException(`No public key registered for user: ${userId}`);
    }
  }
}
