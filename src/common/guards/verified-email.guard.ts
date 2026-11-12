import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { isDeliverableEmail } from '../utils/deliverable-email';
import { ERROR_CODES } from '../filters/all-exceptions.filter';

export const EMAIL_NOT_VERIFIED_MESSAGE =
  'Please confirm your email address first. Use the link we emailed you, or send a new one from the banner on the site.';

export const EMAIL_REQUIRED_MESSAGE =
  'Add and confirm your email address first. Open the Beleqet Jobs bot in Telegram and tap Post Job: it will ask for your email and send you a code.';

type Account = { emailVerified: boolean; role: string; email: string; telegramId: string | null };

async function accountOf(prisma: PrismaService, context: ExecutionContext): Promise<Account> {
  const userId = context.switchToHttp().getRequest<{ user?: { userId?: string } }>().user?.userId;
  if (!userId) throw new UnauthorizedException();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true, role: true, email: true, telegramId: true },
  });
  if (!user) throw new UnauthorizedException();
  return user;
}

function refuse(user: Account): never {
  // A Telegram sign-up has no inbox yet: it needs an address before there is anything to confirm.
  if (!isDeliverableEmail(user.email)) {
    throw new ForbiddenException({
      message: EMAIL_REQUIRED_MESSAGE,
      errorCode: ERROR_CODES.EMAIL_REQUIRED,
    });
  }
  throw new ForbiddenException({
    message: EMAIL_NOT_VERIFIED_MESSAGE,
    errorCode: ERROR_CODES.EMAIL_NOT_VERIFIED,
  });
}

/**
 * Posting jobs and projects and paying need a real, confirmed email: an employer stays
 * accountable for what they post, and payments need an address for receipts. Telegram sign-ups
 * add and confirm one in the bot. Admins pass.
 *
 * Use after JwtAuthGuard, which sets request.user.
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = await accountOf(this.prisma, context);
    if (user.role === 'ADMIN') return true;
    if (user.emailVerified && isDeliverableEmail(user.email)) return true;
    refuse(user);
  }
}

/**
 * Applying and bidding: a confirmed email, or a Telegram account, which already proves who the
 * person is. Job seekers from the bot don't have to confirm an email first. Admins pass.
 *
 * Use after JwtAuthGuard, which sets request.user.
 */
@Injectable()
export class VerifiedEmailOrTelegramGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = await accountOf(this.prisma, context);
    if (user.role === 'ADMIN' || user.telegramId) return true;
    if (user.emailVerified && isDeliverableEmail(user.email)) return true;
    refuse(user);
  }
}
