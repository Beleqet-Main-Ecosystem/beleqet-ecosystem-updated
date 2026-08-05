import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

export interface TelegramUserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

@Injectable()
export class TelegramTmaService {
  private readonly logger = new Logger(TelegramTmaService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Validates the Telegram Mini App initData query string against the Bot Token
   * using standard HMAC-SHA256 verification and checks timestamp validity.
   */
  public verifyInitData(initData: string): TelegramUserData {
    if (!initData || typeof initData !== 'string') {
      throw new UnauthorizedException('Invalid or missing Telegram initData.');
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      throw new UnauthorizedException('Missing hash in Telegram initData.');
    }

    // Remove hash from parameters before creating data-check-string
    params.delete('hash');

    const entries = Array.from(params.entries());
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join('\n');

    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    if (!botToken || botToken === 'your_bot_token_here') {
      this.logger.error('TELEGRAM_BOT_TOKEN is not configured for TMA authentication.');
      throw new UnauthorizedException('Telegram Bot Token is not properly configured.');
    }

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    const hashBuffer = Buffer.from(hash, 'hex');
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
    if (
      hashBuffer.length !== calculatedBuffer.length ||
      !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)
    ) {
      throw new UnauthorizedException('Invalid Telegram WebApp cryptographic signature.');
    }

    // Check expiration timestamp (24 hour limit, and reject clock drift > 5 minutes in future)
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      throw new UnauthorizedException('Missing auth_date in Telegram initData.');
    }
    const authDate = parseInt(authDateStr, 10);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const maxAgeSeconds = 86400; // 24 hours

    if (isNaN(authDate) || nowSeconds - authDate > maxAgeSeconds) {
      throw new UnauthorizedException('Telegram WebApp authentication data has expired.');
    }
    if (authDate - nowSeconds > 300) {
      throw new UnauthorizedException('Invalid Telegram WebApp auth_date timestamp.');
    }

    const userStr = params.get('user');
    if (!userStr) {
      throw new UnauthorizedException('Missing user data in Telegram initData.');
    }

    let userData: TelegramUserData;
    try {
      userData = JSON.parse(userStr);
    } catch {
      throw new UnauthorizedException('Invalid user JSON payload in Telegram initData.');
    }

    if (!userData || !userData.id) {
      throw new UnauthorizedException('Missing Telegram user ID.');
    }

    return userData;
  }

  /**
   * Authenticates a user from a Telegram Mini App.
   * Logs in an existing account by telegramId or provisions a new passwordless profile with the preferred role and wallet.
   */
  async authenticateTmaUser(
    initData: string,
    preferredRole: 'JOB_SEEKER' | 'EMPLOYER' = 'JOB_SEEKER',
  ) {
    const userData = this.verifyInitData(initData);
    const telegramIdStr = String(userData.id);

    const existingUser = await this.prisma.user.findUnique({
      where: { telegramId: telegramIdStr },
      select: { id: true, isActive: true },
    });

    if (existingUser) {
      if (!existingUser.isActive) {
        throw new UnauthorizedException('Account is disabled.');
      }
      this.logger.log(
        `TMA authentication success for user ${existingUser.id} (Telegram ID: ${telegramIdStr})`,
      );
      return this.authService.issueTokensForUserId(existingUser.id);
    }

    const syntheticEmail = `tma_${telegramIdStr}@tme.beleqet.local`;

    // Ensure no conflict with synthetic email if previously created without telegramId
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: syntheticEmail },
      select: { id: true, isActive: true },
    });

    if (existingByEmail) {
      if (!existingByEmail.isActive) {
        throw new UnauthorizedException('Account is disabled.');
      }
      await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: { telegramId: telegramIdStr },
      });
      return this.authService.issueTokensForUserId(existingByEmail.id);
    }

    const newUser = await this.prisma.user.create({
      data: {
        email: syntheticEmail,
        firstName: userData.first_name || 'Telegram',
        lastName: userData.last_name || 'User',
        avatarUrl: userData.photo_url || null,
        telegramId: telegramIdStr,
        emailVerified: true,
        role: preferredRole,
        ...(preferredRole === 'EMPLOYER'
          ? { employerWallet: { create: { balance: 0, lockedBalance: 0 } } }
          : { wallet: { create: {} } }),
      },
      select: { id: true },
    });

    this.logger.log(
      `Provisioned new Telegram TMA account for ID ${telegramIdStr} as ${preferredRole} (${syntheticEmail})`,
    );
    return this.authService.issueTokensForUserId(newUser.id);
  }

  /**
   * Links a verified Telegram identity to an existing authenticated user session.
   */
  async linkTelegramAccount(userId: string, initData: string) {
    const userData = this.verifyInitData(initData);
    const telegramIdStr = String(userData.id);

    const existing = await this.prisma.user.findUnique({
      where: { telegramId: telegramIdStr },
      select: { id: true },
    });

    if (existing && existing.id !== userId) {
      throw new ConflictException(
        'This Telegram account is already linked to another Beleqet profile.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { telegramId: telegramIdStr },
    });

    this.logger.log(`Successfully linked Telegram ID ${telegramIdStr} to user ${userId}`);
    return { success: true, telegramId: telegramIdStr };
  }
}
