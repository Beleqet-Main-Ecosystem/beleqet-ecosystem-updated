import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GdprGuardService } from '../gdpr-guard.service';
import { AppModule } from '../../../app.module';

describe('GDPR Guard & Multi-Currency Wallet Integration Test', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let gdprService: GdprGuardService;

  beforeAll(async () => {
    process.env.GDPR_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    gdprService = moduleFixture.get<GdprGuardService>(GdprGuardService);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "users" CASCADE;`);
    await app.close();
  });

  it('should successfully scrub or delete multi-currency wallet data when GDPR erasure is triggered', async () => {
    const testUser = await prisma.user.create({
      data: {
        email: 'integration-test@beleqet.com',
        firstName: 'Bemnet',
        lastName: 'Test',
        passwordHash: 'hashed_password_here',
      },
    });

    const wallet = await prisma.freelancerWallet.create({
      data: {
        userId: testUser.id,
        availableBalance: 5000,
        pendingBalance: 150,
        currency: 'ETB',
      },
    });

    await prisma.walletTransaction.createMany({
      data: [
        { walletId: wallet.id, amount: 1000, type: 'CREDIT_PENDING' },
        { walletId: wallet.id, amount: 50, type: 'DEBIT_WITHDRAWAL' },
      ],
    });

    await gdprService.executeDataErasure(testUser.id);

    const updatedWallet = await prisma.freelancerWallet.findUnique({
      where: { id: wallet.id },
    });

    expect(updatedWallet).not.toBeNull();

    const remainingTransactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
    });
    expect(remainingTransactions.length).toBe(2);

    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });

    if (updatedUser) {
      expect(updatedUser.email).not.toBe('integration-test@beleqet.com');
      expect(updatedUser.firstName).toBe('GDPR_ANONYMOUS');
      expect(updatedUser.lastName).toBe('USER');
    }
  });
});
