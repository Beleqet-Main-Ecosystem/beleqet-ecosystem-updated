import {
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { BackupCodeService } from './backup-code.service';
import { generateSecret, generateURI, verify } from 'otplib';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

const ENROLLMENT_TOKEN_EXPIRY = 10 * 60;
const STEP_UP_TEMP_EXPIRY = 5 * 60;
const STEP_UP_VERIFIED_EXPIRY = 15 * 60;
const REPLAY_KEY_TTL_MS = 90_000;

const KEY_PREFIX = '2fa:used';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly issuer: string;
  private readonly tempSecret: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly backupCode: BackupCodeService,
  ) {
    this.issuer = config.get<string>('TOTP_ISSUER', 'Beleqet');
    const ts = config.get<string>('TOTP_TEMP_SECRET');
    if (!ts) {
      throw new Error(
        'TOTP_TEMP_SECRET is required. Set it in your environment variables.',
      );
    }
    this.tempSecret = ts;
  }

  private async logAudit(
    eventType: string,
    userId: string,
    reason: string,
    metadata?: Record<string, unknown>,
  ) {
    try {
      await this.prisma.eventLog.create({
        data: {
          eventType,
          entityId: userId,
          entityType: 'User',
          payload: { reason, ...metadata },
          processedBy: 'TwoFactorService',
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  /** Check replay via Redis SETNX — atomic set-if-not-exists with TTL.
   *  Key format: `2fa:used:{userId}:{code}` (90s TTL).
   *  The timeStep is intentionally omitted so that a valid code from any
   *  drift-accepted window cannot be replayed in a subsequent window.
   *  Returns false if the key already exists (replay detected). */
  private async checkReplay(userId: string, code: string): Promise<boolean> {
    const key = `${KEY_PREFIX}:${userId}:${code}`;
    const result = await this.redis.set(key, '1', 'PX', REPLAY_KEY_TTL_MS, 'NX');
    return result === 'OK';
  }

  /** Start 2FA enrollment for a user.
   *  Generates a TOTP secret, encrypts it, and returns a provisioning URI
   *  along with a time-limited enrollment token. */
  async startEnrollment(userId: string) {
    const existing = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (existing?.enabled) {
      throw new ConflictException('Two-factor authentication is already enabled');
    }

    const secret = generateSecret();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new BadRequestException('User not found');

    const encrypted = this.encryption.encrypt(secret);
    const enrollmentToken = this.jwt.sign(
      { sub: userId, purpose: '2fa_enrollment' },
      { secret: this.tempSecret, expiresIn: ENROLLMENT_TOKEN_EXPIRY },
    );

    await this.prisma.userTwoFactor.upsert({
      where: { userId },
      update: {
        secret: encrypted.ciphertext,
        encryptionKeyVersion: encrypted.keyVersion,
        enabled: false,
        enrollmentToken,
        enrollmentExpiresAt: new Date(Date.now() + ENROLLMENT_TOKEN_EXPIRY * 1000),
      },
      create: {
        userId,
        secret: encrypted.ciphertext,
        encryptionKeyVersion: encrypted.keyVersion,
        enabled: false,
        enrollmentToken,
        enrollmentExpiresAt: new Date(Date.now() + ENROLLMENT_TOKEN_EXPIRY * 1000),
      },
    });

    const otpauth = generateURI({ issuer: this.issuer, label: user.email, secret });

    return {
      provisioningUri: otpauth,
      enrollmentToken,
      secret,
    };
  }

  /** Confirm 2FA enrollment by verifying the OTP code from the user's authenticator app.
   *  On success, enables 2FA and generates 10 single-use backup codes. */
  async confirmEnrollment(userId: string, enrollmentToken: string, code: string) {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwt.verify(enrollmentToken, { secret: this.tempSecret }) as any;
    } catch {
      await this.logAudit('2FA_ENROLL_FAILURE', userId, 'expired_token');
      throw new BadRequestException('Invalid or expired enrollment token');
    }

    if (payload.sub !== userId || payload.purpose !== '2fa_enrollment') {
      await this.logAudit('2FA_ENROLL_FAILURE', userId, 'invalid_token');
      throw new BadRequestException('Invalid enrollment token');
    }

    const record = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (!record) throw new BadRequestException('No pending enrollment found');
    if (record.enabled) throw new ConflictException('Already enabled');

    const decryptedSecret = this.encryption.decrypt(record.secret);
    const verifyResult = await verify({ secret: decryptedSecret, token: code });
    if (!verifyResult.valid) {
      await this.logAudit('2FA_ENROLL_FAILURE', userId, 'invalid_code');
      throw new BadRequestException('Invalid code');
    }

    const ok = await this.checkReplay(userId, code);
    if (!ok) {
      await this.logAudit('2FA_ENROLL_FAILURE', userId, 'replay_attempt');
      throw new BadRequestException('This code has already been used');
    }

    const { plainCodes, hashedCodes } = this.backupCode.generate();

    await this.prisma.$transaction(async (tx: any) => {
      await tx.userTwoFactor.update({
        where: { userId },
        data: {
          enabled: true,
          enrollmentToken: null,
          enrollmentExpiresAt: null,
        },
      });

      await tx.backupCode.createMany({
        data: hashedCodes.map((hash: string) => ({
          twoFactorId: record.id,
          codeHash: hash,
        })),
      });
    });

    this.logger.log(`2FA enabled for user ${userId}`);

    return { success: true, backupCodes: plainCodes };
  }

  /** Verify a TOTP code during login.
   *  Returns false if 2FA is not enabled, code is invalid, or code has been replayed. */
  async verifyLogin(userId: string, code: string): Promise<boolean> {
    const record = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (!record || !record.enabled) return false;

    const decryptedSecret = this.encryption.decrypt(record.secret);
    const verifyResult = await verify({ secret: decryptedSecret, token: code });
    if (!verifyResult.valid) {
      await this.logAudit('2FA_VERIFY_FAILURE', userId, 'invalid_code', {
        context: 'login',
      });
      return false;
    }

    const ok = await this.checkReplay(userId, code);
    if (!ok) {
      await this.logAudit('2FA_VERIFY_FAILURE', userId, 'replay_attempt', {
        context: 'login',
      });
      return false;
    }

    return true;
  }

  /** Verify a TOTP code for step-up authentication on sensitive actions.
   *  On success, returns a short-lived step-up JWT with a `2fa_verified_at` claim.
   *  If an action scope was requested in the challenge, it is carried into the
   *  verified token so that StepUpGuard can enforce action-level authorization. */
  async verifyStepUp(userId: string, code: string, action?: string, resourceId?: string): Promise<string> {
    const record = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (!record || !record.enabled) {
      await this.logAudit('2FA_STEPUP_FAILURE', userId, 'not_enabled');
      throw new UnauthorizedException('Two-factor authentication is not enabled');
    }

    const decryptedSecret = this.encryption.decrypt(record.secret);
    const verifyResult = await verify({ secret: decryptedSecret, token: code });
    if (!verifyResult.valid) {
      await this.logAudit('2FA_STEPUP_FAILURE', userId, 'invalid_code');
      throw new UnauthorizedException('Invalid code');
    }

    const ok = await this.checkReplay(userId, code);
    if (!ok) {
      await this.logAudit('2FA_STEPUP_FAILURE', userId, 'replay_attempt');
      throw new UnauthorizedException('This code has already been used');
    }

    await this.prisma.userTwoFactor.update({
      where: { userId },
      data: { lastVerifiedAt: new Date() },
    });

    const tokenClaims: Record<string, any> = {
      sub: userId,
      purpose: '2fa_step_up',
      '2fa_verified_at': Math.floor(Date.now() / 1000),
    };
    if (action) tokenClaims.action = action;
    if (resourceId) tokenClaims.resourceId = resourceId;

    const stepUpToken = this.jwt.sign(tokenClaims,
      { secret: this.tempSecret, expiresIn: STEP_UP_VERIFIED_EXPIRY },
    );

    return stepUpToken;
  }

  /** Verify a backup code and consume it (single-use).
   *  @returns The number of remaining unused backup codes. */
  async verifyBackupCode(userId: string, code: string): Promise<number> {
    const record = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
      include: { backupCodes: true },
    });
    if (!record || !record.enabled) {
      await this.logAudit('2FA_BACKUP_FAILURE', userId, 'not_enabled');
      throw new UnauthorizedException('Two-factor authentication is not enabled');
    }

    const matchingCode = record.backupCodes.find(
      (bc) => !bc.usedAt && this.backupCode.verify(code, bc.codeHash),
    );
    if (!matchingCode) {
      await this.logAudit('2FA_BACKUP_FAILURE', userId, 'invalid_or_used_code');
      throw new UnauthorizedException('Invalid or already used backup code');
    }

    await this.prisma.backupCode.update({
      where: { id: matchingCode.id },
      data: { usedAt: new Date() },
    });

    const remaining = record.backupCodes.filter((bc) => bc.id !== matchingCode.id && !bc.usedAt).length;
    return remaining;
  }

  /** Regenerate all backup codes for a user. Invalidates existing unused codes.
   *  Requires a valid step-up verification beforehand. */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const record = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (!record || !record.enabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const { plainCodes, hashedCodes } = this.backupCode.generate();

    await this.prisma.$transaction(async (tx: any) => {
      await tx.backupCode.deleteMany({ where: { twoFactorId: record.id } });
      await tx.backupCode.createMany({
        data: hashedCodes.map((hash: string) => ({
          twoFactorId: record.id,
          codeHash: hash,
        })),
      });
    });

    return plainCodes;
  }

  /** Disable 2FA for a user. Deletes the encrypted secret and all backup codes. */
  async disable(userId: string): Promise<void> {
    const record = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (!record || !record.enabled) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    await this.prisma.userTwoFactor.delete({ where: { userId } });
    this.logger.log(`2FA disabled for user ${userId}`);
  }

  /** Generate a temporary token for the login 2FA challenge flow.
   *  This token is signed with the temp secret and has a 5-minute expiry. */
  async generateTempToken(userId: string): Promise<{ tempToken: string; factorId: string }> {
    const record = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
      select: { id: true },
    });

    const tempToken = this.jwt.sign(
      { sub: userId, purpose: '2fa_login' },
      { secret: this.tempSecret, expiresIn: STEP_UP_TEMP_EXPIRY },
    );

    return {
      tempToken,
      factorId: record?.id ?? 'unknown',
    };
  }

  /** Remove expired enrollment records where the user never confirmed.
   *  Called periodically via BullMQ scheduled job. */
  async cleanupExpiredEnrollments(): Promise<number> {
    const result = await this.prisma.userTwoFactor.deleteMany({
      where: {
        enabled: false,
        enrollmentExpiresAt: { lt: new Date() },
      },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired 2FA enrollments`);
    }
    return result.count;
  }
}
