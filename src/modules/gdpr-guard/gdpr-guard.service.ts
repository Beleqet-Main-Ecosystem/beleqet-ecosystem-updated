import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class GdprGuardService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;
  private readonly secretKey: Buffer;

  constructor(private readonly prisma: PrismaService) {
    const keyEnv = process.env.GDPR_ENCRYPTION_KEY;
    if (!keyEnv || keyEnv.length !== 64) {
      throw new InternalServerErrorException(
        'GDPR_ENCRYPTION_KEY must be defined in environment variables as a 64-character hex string.',
      );
    }
    this.secretKey = Buffer.from(keyEnv, 'hex');
  }

  /**
   * Encrypts sensitive PII fields using AES-256-GCM before database insertion.
   * @param text Plain text PII string.
   * @returns Formatted ciphertext string (iv:authTag:encryptedData).
   */
  encryptPii(text: string): string {
    if (!text) return text;
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv) as crypto.CipherGCM;

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error: unknown) {
      throw new InternalServerErrorException(
        'Failed to securely encrypt personal identifiable information.',
      );
    }
  }

  /**
   * Decrypts database encrypted fields back to plain text.
   * @param encryptedText Formatted ciphertext (iv:authTag:encryptedData).
   * @returns Decrypted plain text string.
   */
  decryptPii(encryptedText: string): string {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
    try {
      const [ivHex, authTagHex, encryptedDataHex] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.secretKey,
        iv,
      ) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error: unknown) {
      throw new InternalServerErrorException(
        'Failed to decrypt personal identifiable information.',
      );
    }
  }

  /**
   * Executes GDPR Right to be Forgotten by scrubbing PII fields via Prisma.
   * Ensures structural database reference integrity remains intact with Multi-Currency layers.
   * @param userUuid The unique identifier of the target user.
   */
  async executeDataErasure(
    userUuid: string,
  ): Promise<{ success: boolean; scrubbedAt: string; referenceId: string }> {
    // 1. Check if user exists in the unified users infrastructure
    const user = await this.prisma.user.findUnique({
      where: { id: userUuid },
      // Integration check: Include wallet to ensure Multi-Currency balance data integrity is maintained
      include: { wallet: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userUuid} was not found in the ecosystem.`);
    }

    // 2. Perform irreversible anonymization (Scrubbing) on the user model using a transaction
    // This guarantees that any existing multi-currency financial ledger entries remain structurally tied
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userUuid },
        data: {
          firstName: 'GDPR_ANONYMOUS',
          lastName: 'USER',
          email: `scrubbed-${crypto.randomBytes(4).toString('hex')}@beleqet.internal`,
          phone: '0000000000',
        },
      });
    });

    return {
      success: true,
      scrubbedAt: new Date().toISOString(),
      referenceId: crypto.randomBytes(8).toString('hex').toUpperCase(),
    };
  }
}
