import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

export interface DataErasureAuditContext {
  reason: string;
  actorUserId: string;
}

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

  encryptPii(text: string): string {
    if (!text) return text;
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv) as crypto.CipherGCM;

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch {
      throw new InternalServerErrorException(
        'Failed to securely encrypt personal identifiable information.',
      );
    }
  }

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
    } catch {
      throw new InternalServerErrorException(
        'Failed to decrypt personal identifiable information.',
      );
    }
  }

  async executeDataErasure(
    userUuid: string,
    audit: DataErasureAuditContext,
  ): Promise<{ success: boolean; scrubbedAt: string; referenceId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userUuid },
      include: { wallet: true, employerWallet: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userUuid} was not found in the ecosystem.`);
    }

    const scrubbedAt = new Date().toISOString();
    const referenceId = crypto.randomBytes(8).toString('hex').toUpperCase();

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

      if (user.wallet) {
        await tx.freelancerWallet.update({
          where: { id: user.wallet.id },
          data: { availableBalance: 0, pendingBalance: 0 },
        });
        await tx.walletTransaction.updateMany({
          where: { walletId: user.wallet.id },
          data: { note: 'GDPR_SCRUBBED' },
        });
      }

      if (user.employerWallet) {
        await tx.employerWallet.update({
          where: { id: user.employerWallet.id },
          data: { balance: 0, lockedBalance: 0 },
        });
        await tx.employerWalletTransaction.updateMany({
          where: { walletId: user.employerWallet.id },
          data: { note: 'GDPR_SCRUBBED' },
        });
      }

      await tx.eventLog.create({
        data: {
          eventType: 'GDPR_DATA_ERASURE',
          entityId: userUuid,
          entityType: 'User',
          payload: {
            reason: audit.reason,
            actorUserId: audit.actorUserId,
            targetUserId: userUuid,
            referenceId,
            scrubbedAt,
          },
          processedBy: audit.actorUserId,
        },
      });
    });

    return { success: true, scrubbedAt, referenceId };
  }
}
