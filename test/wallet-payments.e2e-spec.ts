import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Wallet & Payments Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  const testSuffix = randomUUID().substring(0, 8);
  let freelancer: any;
  let freelancerToken = '';
  let employer: any;
  let employerToken = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );

    await app.init();
    prisma = moduleFixture.get(PrismaService);
    authService = moduleFixture.get(AuthService);

    // Create test freelancer user
    freelancer = await prisma.user.create({
      data: {
        email: `freelance-wallet-${testSuffix}@example.com`,
        firstName: 'Free',
        lastName: 'Lancer',
        role: 'FREELANCER',
      },
    });
    const freeTokens: any = await authService.login(freelancer);
    freelancerToken = freeTokens.accessToken;

    // Create test employer user
    employer = await prisma.user.create({
      data: {
        email: `employer-wallet-${testSuffix}@example.com`,
        firstName: 'Boss',
        lastName: 'Employer',
        role: 'EMPLOYER',
      },
    });
    const empTokens: any = await authService.login(employer);
    employerToken = empTokens.accessToken;
  }, 90000);

  afterAll(async () => {
    try {
      if (freelancer?.id) {
        await prisma.walletTransaction.deleteMany({
          where: { wallet: { userId: freelancer.id } },
        });
        await prisma.freelancerWallet.deleteMany({ where: { userId: freelancer.id } });
        await prisma.user.deleteMany({ where: { id: freelancer.id } });
      }
      if (employer?.id) {
        await prisma.employerWallet.deleteMany({ where: { userId: employer.id } });
        await prisma.user.deleteMany({ where: { id: employer.id } });
      }
    } catch {
      // ignore cleanup errors
    }
    await app.close();
  });

  describe('Wallet Creation & Retrieval (Journeys 5.1)', () => {
    it('5.1 should retrieve or create freelancer wallet upon request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/wallet')
        .set('Authorization', `Bearer ${freelancerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.userId).toBe(freelancer.id);
      expect(res.body.availableBalance).toBe(0);
      expect(res.body.currency).toBe('ETB');
    });

    it('should retrieve or create employer wallet', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/wallet/employer')
        .set('Authorization', `Bearer ${employerToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body.userId).toBe(employer.id);
      expect(res.body.balance).toBe(0);
    });
  });

  describe('Withdrawal Validation & Atomic Double-Spend Prevention (Journeys 5.6 - 5.8)', () => {
    it('5.8 should reject withdrawal when balance is insufficient (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/wallet/withdraw')
        .set('Authorization', `Bearer ${freelancerToken}`)
        .send({
          amount: 500,
          currency: 'ETB',
          method: 'TELEBIRR',
          accountRef: '+251911223344',
        })
        .expect(400);

      expect(res.body.message).toMatch(/insufficient/i);
    });

    it('5.6 & 5.7 should fund wallet and execute atomic double-spend prevention', async () => {
      // Direct database credit simulating confirmed escrow release / deposit of 500 ETB
      await prisma.freelancerWallet.update({
        where: { userId: freelancer.id },
        data: { availableBalance: 500 },
      });

      // Fire two concurrent withdrawal requests for 500 ETB each
      const [req1, req2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/wallet/withdraw')
          .set('Authorization', `Bearer ${freelancerToken}`)
          .send({
            amount: 500,
            currency: 'ETB',
            method: 'TELEBIRR',
            accountRef: '+251911223344',
          }),
        request(app.getHttpServer())
          .post('/api/v1/wallet/withdraw')
          .set('Authorization', `Bearer ${freelancerToken}`)
          .send({
            amount: 500,
            currency: 'ETB',
            method: 'TELEBIRR',
            accountRef: '+251911223344',
          }),
      ]);

      const statuses = [req1.status, req2.status];
      // Exactly one request should succeed (201/200) and one must be rejected with 400
      expect(statuses).toContain(400);
      const successCount = statuses.filter((s) => s === 200 || s === 201).length;
      expect(successCount).toBe(1);

      // Verify wallet balance is now 0 (no negative balance or double deduction)
      const wallet = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });
      expect(wallet?.availableBalance).toBe(0);
    });
  });

  describe('Step-Up 2FA Guard Enforcement (Journey 1.15)', () => {
    it('1.15 should enforce step-up authentication when 2FA is enabled on account', async () => {
      // Enable 2FA on the user
      await prisma.userTwoFactor.upsert({
        where: { userId: freelancer.id },
        update: { enabled: true },
        create: {
          userId: freelancer.id,
          secret: 'dummy-encrypted-secret',
          enabled: true,
        },
      });

      // Re-credit 100 ETB
      await prisma.freelancerWallet.update({
        where: { userId: freelancer.id },
        data: { availableBalance: 100 },
      });

      // Attempt withdrawal without step-up token -> must return 401 requiring step-up
      const res = await request(app.getHttpServer())
        .post('/api/v1/wallet/withdraw')
        .set('Authorization', `Bearer ${freelancerToken}`)
        .send({
          amount: 50,
          currency: 'ETB',
          method: 'TELEBIRR',
          accountRef: '+251911223344',
        })
        .expect(401);

      expect(res.body.requiresStepUp).toBe(true);
      expect(res.body.stepUpToken).toBeDefined();

      // Clean up 2FA record
      await prisma.userTwoFactor.deleteMany({ where: { userId: freelancer.id } });
    });
  });
});
