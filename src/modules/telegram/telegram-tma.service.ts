import { Injectable, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ERROR_CODES } from '../../common/filters/all-exceptions.filter';
import { cleanTelegramUsername, linkTelegram } from './telegram-link';

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

    // A Mini App is signed by the bot that opened it: the API's own bot or the Jobs bot.
    const botTokens = this.miniAppBotTokens();
    if (botTokens.length === 0) {
      this.logger.error('TELEGRAM_BOT_TOKEN is not configured for TMA authentication.');
      throw new UnauthorizedException('Telegram Bot Token is not properly configured.');
    }

    const hashBuffer = Buffer.from(hash, 'hex');
    const signedByOurBot = botTokens.some((botToken) => {
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest();
      return (
        hashBuffer.length === calculated.length && crypto.timingSafeEqual(hashBuffer, calculated)
      );
    });
    if (!signedByOurBot) {
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
   * Validates the data Telegram's login button hands the website (https://core.telegram.org/widgets/login):
   * an HMAC-SHA256 of the sorted fields, keyed with SHA-256 of the bot's token, no older than a day.
   */
  public verifyLoginWidget(data: Record<string, unknown>): TelegramUserData {
    const hash = typeof data?.hash === 'string' ? data.hash : '';
    if (!/^[0-9a-f]{64}$/i.test(hash)) {
      throw new UnauthorizedException('Missing or invalid Telegram login data.');
    }
    const dataCheckString = Object.keys(data)
      .filter((key) => key !== 'hash' && data[key] !== undefined && data[key] !== null)
      .sort()
      .map((key) => `${key}=${String(data[key])}`)
      .join('\n');

    const hashBuffer = Buffer.from(hash, 'hex');
    const signedByOurBot = this.miniAppBotTokens().some((botToken) => {
      const secretKey = crypto.createHash('sha256').update(botToken).digest();
      const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest();
      return (
        hashBuffer.length === calculated.length && crypto.timingSafeEqual(hashBuffer, calculated)
      );
    });
    if (!signedByOurBot) {
      throw new UnauthorizedException('Invalid Telegram login signature.');
    }

    const authDate = Number(data.auth_date);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isFinite(authDate) ||
      nowSeconds - authDate > 86400 ||
      authDate - nowSeconds > 300
    ) {
      throw new UnauthorizedException('This Telegram sign-in has expired. Try again.');
    }
    const id = Number(data.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new UnauthorizedException('Missing Telegram user ID.');
    }
    const field = (key: string) =>
      typeof data[key] === 'string' ? (data[key] as string) : undefined;
    return {
      id,
      first_name: field('first_name') ?? '',
      last_name: field('last_name'),
      username: field('username'),
      photo_url: field('photo_url'),
    };
  }

  /**
   * Signs in the account linked to the Telegram user who opened the Mini App. Someone without
   * one is refused (ERR_TELEGRAM_NOT_REGISTERED) and browses as a guest until they register.
   */
  async authenticateTmaUser(initData: string) {
    return this.signIn(this.verifyInitData(initData));
  }

  /** "Sign in with Telegram" on the website or in the app: existing accounts only. */
  async authenticateLoginWidget(data: Record<string, unknown>) {
    return this.signIn(this.verifyLoginWidget(data));
  }

  private async signIn(userData: TelegramUserData) {
    const telegramIdStr = String(userData.id);

    const existingUser = await this.prisma.user.findUnique({
      where: { telegramId: telegramIdStr },
      select: { id: true, isActive: true, role: true, telegramUsername: true },
    });
    // Telegram's own record, so employers can reach the person; people change it now and then.
    const username = cleanTelegramUsername(userData.username);

    if (existingUser) {
      if (!existingUser.isActive) {
        throw new UnauthorizedException('Account is disabled.');
      }
      if (username && username !== existingUser.telegramUsername) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: { telegramUsername: username },
        });
      }
      this.logger.log(
        `Telegram sign-in for user ${existingUser.id} (Telegram ID: ${telegramIdStr})`,
      );
      return this.sessionFor(existingUser);
    }

    // An account made before sign-in became sign-in only, whose Telegram link was lost.
    const syntheticEmail = `tma_${telegramIdStr}@tme.beleqet.local`;
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: syntheticEmail },
      select: { id: true, isActive: true, role: true },
    });

    if (existingByEmail) {
      if (!existingByEmail.isActive) {
        throw new UnauthorizedException('Account is disabled.');
      }
      await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: { telegramId: telegramIdStr },
      });
      return this.sessionFor(existingByEmail);
    }

    // Sign-in only: accounts are made in the bot, which asks for the phone, gender, residence and
    // job title (or with an email). Creating one here left empty, unnamed accounts nobody chose.
    throw new NotFoundException({
      message:
        'This Telegram account isn’t registered on Beleqet yet. Register in the Beleqet Jobs bot first (it takes a minute), or sign in with your email.',
      errorCode: ERROR_CODES.TELEGRAM_NOT_REGISTERED,
    });
  }

  /**
   * Session for an existing account. Admins sign in with their password, and an account with
   * two-step sign-in still has to enter its code, as with Google or LinkedIn.
   */
  private sessionFor(user: { id: string; role: string }) {
    if (user.role === 'ADMIN') {
      throw new UnauthorizedException('Admins sign in with their password.');
    }
    return this.authService.oauthSession(user.id);
  }

  /** TELEGRAM_BOT_TOKEN plus TELEGRAM_MINI_APP_BOT_TOKENS (comma-separated, e.g. the Jobs bot's). */
  private miniAppBotTokens(): string[] {
    const own = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    const others = this.configService.get<string>('TELEGRAM_MINI_APP_BOT_TOKENS') || '';
    return [own, ...others.split(',')]
      .map((token) => token.trim())
      .filter((token) => token && token !== 'your_bot_token_here');
  }

  /** Links the Telegram account that opened the Mini App to the signed-in account. */
  async linkTelegramAccount(userId: string, initData: string) {
    const userData = this.verifyInitData(initData);
    const result = await linkTelegram(this.prisma, userId, userData);
    this.logger.log(`Linked Telegram ID ${result.telegramId} to user ${userId}`);
    return { success: true, telegramId: result.telegramId };
  }

  /** "Connect Telegram" in the website's settings, with Telegram's login button. */
  async connectWithLoginWidget(userId: string, data: Record<string, unknown>) {
    const userData = this.verifyLoginWidget(data);
    const result = await linkTelegram(this.prisma, userId, userData);
    this.logger.log(`Connected Telegram ID ${result.telegramId} to user ${userId}`);
    return {
      success: true,
      telegramId: result.telegramId,
      username: cleanTelegramUsername(userData.username),
    };
  }
}
