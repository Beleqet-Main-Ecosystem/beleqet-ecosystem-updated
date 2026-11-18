import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EMAIL_NOT_VERIFIED_MESSAGE,
  EMAIL_REQUIRED_MESSAGE,
  VerifiedEmailGuard,
  VerifiedEmailOrTelegramGuard,
} from './verified-email.guard';

const context = (user?: { userId: string }) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

type Record = { emailVerified: boolean; role: string; email: string; telegramId?: string | null };

const prismaFor = (record: Record | null) =>
  ({
    user: {
      findUnique: jest.fn().mockResolvedValue(record && { telegramId: null, ...record }),
    },
  }) as unknown as PrismaService;

const strict = (record: Record | null) => new VerifiedEmailGuard(prismaFor(record));
const relaxed = (record: Record | null) => new VerifiedEmailOrTelegramGuard(prismaFor(record));

describe('VerifiedEmailGuard (posting and paying)', () => {
  it('lets a confirmed account through', async () => {
    const guard = strict({ emailVerified: true, role: 'EMPLOYER', email: 'hr@company.et' });
    await expect(guard.canActivate(context({ userId: 'u1' }))).resolves.toBe(true);
  });

  it('refuses an unconfirmed account with a message saying what to do', async () => {
    const guard = strict({ emailVerified: false, role: 'EMPLOYER', email: 'me@gmail.com' });
    const attempt = guard.canActivate(context({ userId: 'u2' }));
    await expect(attempt).rejects.toThrow(ForbiddenException);
    await expect(attempt).rejects.toThrow(EMAIL_NOT_VERIFIED_MESSAGE);
  });

  it('refuses a Telegram sign-up until it adds a real email, and says where', async () => {
    for (const email of ['telegram_1@beleqet.internal', 'tma_1@tme.beleqet.local']) {
      const guard = strict({ emailVerified: true, role: 'EMPLOYER', email, telegramId: '1' });
      await expect(guard.canActivate(context({ userId: 't' }))).rejects.toThrow(
        EMAIL_REQUIRED_MESSAGE,
      );
    }
  });

  it('refuses an unconfirmed email even with a Telegram account', async () => {
    const guard = strict({
      emailVerified: false,
      role: 'EMPLOYER',
      email: 'boss@company.et',
      telegramId: '7',
    });
    await expect(guard.canActivate(context({ userId: 'b' }))).rejects.toThrow(
      EMAIL_NOT_VERIFIED_MESSAGE,
    );
  });

  it('lets admins through', async () => {
    const guard = strict({ emailVerified: false, role: 'ADMIN', email: 'ops@beleqet.com' });
    await expect(guard.canActivate(context({ userId: 'a' }))).resolves.toBe(true);
  });

  it('refuses a request without a signed-in user', async () => {
    const guard = strict(null);
    await expect(guard.canActivate(context())).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context({ userId: 'gone' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('VerifiedEmailOrTelegramGuard (applying and bidding)', () => {
  it('lets a Telegram account through without a confirmed email', async () => {
    const placeholder = relaxed({
      emailVerified: true,
      role: 'JOB_SEEKER',
      email: 'tma_9@tme.beleqet.local',
      telegramId: '9',
    });
    await expect(placeholder.canActivate(context({ userId: 'p' }))).resolves.toBe(true);
    const typed = relaxed({
      emailVerified: false,
      role: 'JOB_SEEKER',
      email: 'abebe@gmail.com',
      telegramId: '10',
    });
    await expect(typed.canActivate(context({ userId: 'q' }))).resolves.toBe(true);
  });

  it('lets a confirmed website account through', async () => {
    const guard = relaxed({ emailVerified: true, role: 'JOB_SEEKER', email: 'me@gmail.com' });
    await expect(guard.canActivate(context({ userId: 'w' }))).resolves.toBe(true);
  });

  it('refuses an unconfirmed website account', async () => {
    const guard = relaxed({ emailVerified: false, role: 'JOB_SEEKER', email: 'me@gmail.com' });
    await expect(guard.canActivate(context({ userId: 'u' }))).rejects.toThrow(
      EMAIL_NOT_VERIFIED_MESSAGE,
    );
  });
});
