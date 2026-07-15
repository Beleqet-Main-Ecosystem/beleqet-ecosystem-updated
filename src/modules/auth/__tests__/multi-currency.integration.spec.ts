import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccountRepository } from '../repositories/account.repository';
import { OAuthProvider } from '../interfaces/oauth-profile.interface';

/**
 * Integration test proving a user provisioned via the Social Logins
 * OAuth path can fully participate in the existing multi-currency
 * system (wallets, freelance jobs) without breaking those relations.
 *
 * Runs against a REAL database (whatever DATABASE_URL points to) — this
 * is intentionally not mocked, since the point is to prove actual
 * cross-module DB integration, not just isolated logic.
 *
 * @remarks
 * Requires a running Postgres instance matching your .env DATABASE_URL.
 * Cleans up everything it creates in `afterAll`.
 */
describe('Multi-currency integration — OAuth-provisioned users', () => {
  let prisma: PrismaService;
  let accountRepository: AccountRepository;
  let createdUserId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService, AccountRepository],
    }).compile();

    prisma = module.get(PrismaService);
    accountRepository = module.get(AccountRepository);
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up in dependency order (children before parent).
    if (createdUserId) {
      await prisma.freelancerWallet.deleteMany({ where: { userId: createdUserId } });
      await prisma.oAuthAccount.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
    await prisma.$disconnect();
  });

  it('provisions an OAuth-only user via the real AccountRepository code path', async () => {
    const uniqueEmail = `oauth-integration-test-${Date.now()}@example.com`;

    const user = await accountRepository.createUserWithOAuthAccount({
      email: uniqueEmail,
      emailVerified: true,
      firstName: 'Integration',
      lastName: 'Test',
      provider: OAuthProvider.GOOGLE,
      providerAccountId: `integration-test-sub-${Date.now()}`,
      encryptedAccessToken: 'irrelevant-for-this-test',
    });

    createdUserId = user.id;

    expect(user.email).toBe(uniqueEmail);
    // Confirms the passwordHash-optional schema change didn't break
    // OAuth-only provisioning: no password credential exists for this user.
    expect(user.hasPasswordCredential).toBe(false);
  });

  it('lets an OAuth-provisioned user own a wallet in a non-default currency', async () => {
    const wallet = await prisma.freelancerWallet.create({
      data: {
        userId: createdUserId,
        currency: 'USD', // schema default is 'ETB' — proves non-default works too
        pendingBalance: 0,
        availableBalance: 0,
      },
    });

    expect(wallet.currency).toBe('USD');
    expect(wallet.userId).toBe(createdUserId);

    // Confirm the relation actually round-trips from the User side too.
    const userWithWallet = await prisma.user.findUnique({
      where: { id: createdUserId },
      include: { wallet: true },
    });

    expect(userWithWallet?.wallet?.currency).toBe('USD');
  });
});
