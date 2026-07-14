import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { GdprGuardService } from '../gdpr-guard.service';
import { GdprGuardModule } from '../gdpr-guard.module';

describe('GDPR Guard & Wallet Integration Test', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let gdprService: GdprGuardService;

  const audit = {
    reason: 'Integration test GDPR erasure',
    actorUserId: '00000000-0000-4000-8000-000000000099',
  };

  beforeAll(async () => {
    process.env.GDPR_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        GdprGuardModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    gdprService = moduleFixture.get<GdprGuardService>(GdprGuardService);
  }, 30000);

  afterAll(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "users" CASCADE;`);
    await app.close();
  }, 30000);

  it('should scrub user PII, sanitize wallet balances and transaction notes, and persist audit log', async () => {
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
        {
          walletId: wallet.id,
          amount: 1000,
          type: 'CREDIT_PENDING',
          note: 'Deposit from Bemnet Test - account ending 4521',
        },
        {
          walletId: wallet.id,
          amount: 50,
          type: 'DEBIT_WITHDRAWAL',
          note: 'Withdrawal to beleqet-test@bank.com',
        },
      ],
    });

    const result = await gdprService.executeDataErasure(testUser.id, audit);

    const updatedWallet = await prisma.freelancerWallet.findUnique({
      where: { id: wallet.id },
    });
    expect(updatedWallet).not.toBeNull();
    expect(updatedWallet!.availableBalance).toBe(0);
    expect(updatedWallet!.pendingBalance).toBe(0);

    const remainingTransactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
    });
    expect(remainingTransactions.length).toBe(2);
    expect(remainingTransactions.every((tx) => tx.note === 'GDPR_SCRUBBED')).toBe(true);

    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(updatedUser).not.toBeNull();
    expect(updatedUser!.email).not.toBe('integration-test@beleqet.com');
    expect(updatedUser!.firstName).toBe('GDPR_ANONYMOUS');
    expect(updatedUser!.lastName).toBe('USER');

    const auditLog = await prisma.eventLog.findFirst({
      where: {
        eventType: 'GDPR_DATA_ERASURE',
        entityId: testUser.id,
      },
    });
    expect(auditLog).not.toBeNull();
    expect(auditLog!.processedBy).toBe(audit.actorUserId);
    expect(auditLog!.payload).toMatchObject({
      reason: audit.reason,
      actorUserId: audit.actorUserId,
      targetUserId: testUser.id,
      referenceId: result.referenceId,
      scrubbedAt: result.scrubbedAt,
    });
  });
});
