import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_NOT_VERIFIED_MESSAGE, VerifiedEmailGuard } from './verified-email.guard';

const context = (user?: { userId: string }) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

const guardFor = (record: { emailVerified: boolean; role: string; email: string } | null) =>
  new VerifiedEmailGuard({
    user: { findUnique: jest.fn().mockResolvedValue(record) },
  } as unknown as PrismaService);

describe('VerifiedEmailGuard', () => {
  it('lets a confirmed account through', async () => {
    const guard = guardFor({ emailVerified: true, role: 'EMPLOYER', email: 'hr@company.et' });
    await expect(guard.canActivate(context({ userId: 'u1' }))).resolves.toBe(true);
  });

  it('refuses an unconfirmed account with a message saying what to do', async () => {
    const guard = guardFor({ emailVerified: false, role: 'JOB_SEEKER', email: 'me@gmail.com' });
    const attempt = guard.canActivate(context({ userId: 'u2' }));
    await expect(attempt).rejects.toThrow(ForbiddenException);
    await expect(attempt).rejects.toThrow(EMAIL_NOT_VERIFIED_MESSAGE);
  });

  it('lets admins and placeholder-address accounts (Telegram sign-ups) through', async () => {
    await expect(
      guardFor({ emailVerified: false, role: 'ADMIN', email: 'ops@beleqet.com' }).canActivate(
        context({ userId: 'a' }),
      ),
    ).resolves.toBe(true);
    await expect(
      guardFor({
        emailVerified: false,
        role: 'EMPLOYER',
        email: 'telegram_1@beleqet.internal',
      }).canActivate(context({ userId: 't' })),
    ).resolves.toBe(true);
  });

  it('refuses a request without a signed-in user', async () => {
    const guard = guardFor(null);
    await expect(guard.canActivate(context())).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context({ userId: 'gone' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
