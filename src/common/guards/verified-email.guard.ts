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

/**
 * Lets only accounts with a confirmed email post jobs and projects, apply, bid and pay.
 * Signing in and browsing stay open to everyone. Admins pass, and so do accounts whose address
 * is a placeholder (Telegram bot and Mini App sign-ups), which have no inbox to confirm.
 *
 * Use after JwtAuthGuard, which sets request.user.
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const userId = context.switchToHttp().getRequest<{ user?: { userId?: string } }>().user?.userId;
    if (!userId) throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true, role: true, email: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.emailVerified || user.role === 'ADMIN' || !isDeliverableEmail(user.email)) return true;

    throw new ForbiddenException({
      message: EMAIL_NOT_VERIFIED_MESSAGE,
      errorCode: ERROR_CODES.EMAIL_NOT_VERIFIED,
    });
  }
}
