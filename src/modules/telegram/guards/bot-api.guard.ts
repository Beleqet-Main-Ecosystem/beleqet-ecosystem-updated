import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/** Header the Jobs bot sends on every request (BELEQET_API_SECRET_TOKEN in the bot's .env). */
export const BOT_API_TOKEN_HEADER = 'x-beleqet-api-token';

/**
 * Only the Jobs bot may call the bot endpoints (register, check-user, linking, the Telegram ID list).
 * They were public, which let anyone list users' Telegram IDs and take over accounts. Without
 * TELEGRAM_BOT_API_TOKEN configured, every request is refused.
 */
@Injectable()
export class BotApiGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('TELEGRAM_BOT_API_TOKEN') ?? '';
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const raw = request.headers[BOT_API_TOKEN_HEADER];
    const provided = Array.isArray(raw) ? raw[0] : (raw ?? '');
    if (!expected || !provided || !sameSecret(provided, expected)) {
      throw new UnauthorizedException('Not allowed');
    }
    return true;
  }
}

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
