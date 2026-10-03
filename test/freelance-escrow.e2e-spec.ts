import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Freelance & Escrow Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  const testSuffix = randomUUID().substring(0, 8);
  let employer: any;
  let freelancer: any;
  let employerToken = '';
  let freelancerToken = '';
  let categoryId = '';
  let freelanceJobId = '';
  let contractId = '';
  let milestoneId = '';

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

    // Setup category
    let cat = await prisma.freelanceCategory.findFirst();
    if (!cat) {
      cat = await prisma.freelanceCategory.create({
        data: {
          label: `Freelance-${testSuffix}`,
          slug: `freelance-${testSuffix}`,
        },
      });
    }
    categoryId = cat.id;

    // Create client/employer
    employer = await prisma.user.create({
      data: {
        email: `escrow-emp-${testSuffix}@example.com`,
        firstName: 'EscrowClient',
        lastName: 'Corp',
        role: 'EMPLOYER',
      },
    });
    const empTokens: any = await authService.login(employer);
    employerToken = empTokens.accessToken;

    // Create freelancer
    freelancer = await prisma.user.create({
      data: {
        email: `escrow-free-${testSuffix}@example.com`,
        firstName: 'Dev',
        lastName: 'Freelancer',
        role: 'FREELANCER',
      },
    });
    const freeTokens: any = await authService.login(freelancer);
    freelancerToken = freeTokens.accessToken;

    // Create FreelanceJob
    const freelanceJob = await prisma.freelanceJob.create({
      data: {
        title: `Fullstack Next.js + NestJS Platform ${testSuffix}`,
        description: 'Build enterprise application with automated testing',
        categoryId,
        clientId: employer.id,
        budgetMin: 5000,
        budgetMax: 10000,
        deadlineDays: 14,
        skills: ['NestJS', 'React', 'PostgreSQL'],
        status: 'OPEN',
      },
    });
    freelanceJobId = freelanceJob.id;

    // Create active contract
    const contract = await prisma.contract.create({
      data: {
        freelanceJobId,
        clientId: employer.id,
        freelancerId: freelancer.id,
        agreedAmount: 8000,
        currency: 'ETB',
        status: 'ACTIVE',
      },
    });
    contractId = contract.id;

    // Create a funded milestone
    const milestone = await prisma.milestone.create({
      data: {
        contractId,
        title: 'Milestone 1: Backend Architecture & Auth API',
        description: 'Implement auth, RBAC, and database schemas',
        amount: 4000,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'IN_PROGRESS',
      },
    });
    milestoneId = milestone.id;
  }, 90000);

  afterAll(async () => {
    try {
      if (milestoneId) {
        await prisma.milestone.deleteMany({ where: { id: milestoneId } });
      }
      if (contractId) {
        await prisma.contract.deleteMany({ where: { id: contractId } });
      }
      if (freelanceJobId) {
        await prisma.freelanceJob.deleteMany({ where: { id: freelanceJobId } });
      }
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
      // Ignore cleanup error
    }
    await app.close();
  });

  describe('Milestone Dual-Approval Confirmation (Journeys 4.6 - 4.8)', () => {
    it('4.6 should allow employer to submit milestone confirmation', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/escrow/milestones/${milestoneId}/confirm`)
        .set('Authorization', `Bearer ${employerToken}`)
        .send({ note: 'Milestone deliverables look great, verified working' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.released).toBe(false);
      expect(res.body.waitingFor).toBe('FREELANCER');
    });

    it('4.7 should reject milestone confirmation from unauthorized party (404 Not Found)', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: `stranger-${testSuffix}@example.com`,
          firstName: 'Random',
          lastName: 'Intruder',
          role: 'JOB_SEEKER',
        },
      });
      const strangerTokens: any = await authService.login(otherUser);

      await request(app.getHttpServer())
        .post(`/api/v1/escrow/milestones/${milestoneId}/confirm`)
        .set('Authorization', `Bearer ${strangerTokens.accessToken}`)
        .send({ note: 'Malicious approval' })
        .expect(404);

      await prisma.user.deleteMany({ where: { id: otherUser.id } });
    });

    it('4.7 & 4.8 should complete dual confirmation when freelancer confirms', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/escrow/milestones/${milestoneId}/confirm`)
        .set('Authorization', `Bearer ${freelancerToken}`)
        .send({ note: 'Milestone work completed and verified on my end' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.released).toBe(true);

      const dbMilestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
      expect(dbMilestone?.status).toBe('APPROVED');
      expect(dbMilestone?.employerApprovedAt).not.toBeNull();
      expect(dbMilestone?.freelancerApprovedAt).not.toBeNull();
    });
  });
});
