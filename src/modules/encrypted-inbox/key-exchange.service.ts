import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterKeyPairDto } from './dto/encrypted-inbox.dto';

/**
 * Manages E2EE asymmetric key pairs for users.
 *
 * Each user generates an RSA key pair client-side.  The public key is
 * stored in plaintext on the server (safe to distribute for key exchange),
 * while the private key is encrypted with a server-held key before storage.
 *
 * **Zero-Knowledge Architecture**: The server cannot decrypt the private key
 * under normal operation.  It is only decrypted during GDPR data-export
 * workflows when the user proves identity via 2FA step-up.
 *
 * @remarks GDPR: Users can request deletion of their key pair, which
 * effectively renders all their encrypted messages unreadable.
 */
@Injectable()
export class KeyExchangeService {
  private readonly logger = new Logger(KeyExchangeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a user's E2EE key pair.
   *
   * @param userId - The user's UUID
   * @param dto - Contains publicKey and encryptedPrivateKey
   * @returns The created key pair record
   * @throws ConflictException if the user already has a registered key pair
   */
  async registerKeyPair(userId: string, dto: RegisterKeyPairDto) {
    const existing = await this.prisma.e2EKeyPair.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException(
        'User already has a registered key pair. Use rotateKeyPair to update.',
      );
    }

    const keyPair = await this.prisma.e2EKeyPair.create({
      data: {
        userId,
        publicKey: dto.publicKey,
        encryptedPrivateKey: dto.encryptedPrivateKey,
        algorithm: dto.algorithm || 'RSA-OAEP-256',
      },
    });

    this.logger.log(`Registered E2EE key pair for user ${userId}`);
    return keyPair;
  }

  /**
   * Rotate (replace) a user's key pair.
   *
   * This is used when a user generates new keys or when keys are
   * compromised.  Old messages encrypted with the previous public key
   * remain readable if the client retains the old private key.
   *
   * @param userId - The user's UUID
   * @param dto - Contains new publicKey and encryptedPrivateKey
   * @returns The updated key pair record
   */
  async rotateKeyPair(userId: string, dto: RegisterKeyPairDto) {
    const keyPair = await this.prisma.e2EKeyPair.upsert({
      where: { userId },
      create: {
        userId,
        publicKey: dto.publicKey,
        encryptedPrivateKey: dto.encryptedPrivateKey,
        algorithm: dto.algorithm || 'RSA-OAEP-256',
      },
      update: {
        publicKey: dto.publicKey,
        encryptedPrivateKey: dto.encryptedPrivateKey,
        algorithm: dto.algorithm || 'RSA-OAEP-256',
      },
    });

    this.logger.log(`Rotated E2EE key pair for user ${userId}`);
    return keyPair;
  }

  /**
   * Retrieve a user's public key for message encryption.
   *
   * @param userId - The target user's UUID
   * @returns The public key in SPKI format
   * @throws NotFoundException if no key pair exists for the user
   */
  async getPublicKey(userId: string): Promise<string> {
    const keyPair = await this.prisma.e2EKeyPair.findUnique({
      where: { userId },
      select: { publicKey: true },
    });

    if (!keyPair) {
      throw new NotFoundException(`No E2EE key pair found for user ${userId}`);
    }

    return keyPair.publicKey;
  }

  /**
   * Retrieve a user's encrypted private key (GDPR export only).
   *
   * This is only called after 2FA step-up verification.  The server
   * decrypts the private key and returns it encrypted with a temporary
   * key that only the client can decrypt.
   *
   * @param userId - The user's UUID
   * @returns The encrypted private key
   * @throws NotFoundException if no key pair exists
   */
  async getEncryptedPrivateKey(userId: string): Promise<string> {
    const keyPair = await this.prisma.e2EKeyPair.findUnique({
      where: { userId },
      select: { encryptedPrivateKey: true },
    });

    if (!keyPair) {
      throw new NotFoundException(`No E2EE key pair found for user ${userId}`);
    }

    return keyPair.encryptedPrivateKey;
  }

  /**
   * Check if a user has a registered E2EE key pair.
   *
   * @param userId - The user's UUID
   * @returns true if a key pair exists
   */
  async hasKeyPair(userId: string): Promise<boolean> {
    const count = await this.prisma.e2EKeyPair.count({ where: { userId } });
    return count > 0;
  }

  /**
   * Delete a user's key pair (GDPR right to erasure).
   *
   * After deletion, all messages encrypted with this user's public key
   * become permanently unreadable.
   *
   * @param userId - The user's UUID
   */
  async deleteKeyPair(userId: string): Promise<void> {
    await this.prisma.e2EKeyPair.deleteMany({ where: { userId } });
    this.logger.log(`Deleted E2EE key pair for user ${userId}`);
  }

  /**
   * Retrieve public keys for multiple users in a single query.
   *
   * Used by the KeyExchangeService to batch-fetch public keys for
   * conversation participants.
   *
   * @param userIds - Array of user UUIDs
   * @returns Map of userId -> publicKey
   */
  async getPublicKeysForUsers(
    userIds: string[],
  ): Promise<Map<string, string>> {
    const keyPairs = await this.prisma.e2EKeyPair.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, publicKey: true },
    });

    const map = new Map<string, string>();
    for (const kp of keyPairs) {
      map.set(kp.userId, kp.publicKey);
    }
    return map;
  }
}
