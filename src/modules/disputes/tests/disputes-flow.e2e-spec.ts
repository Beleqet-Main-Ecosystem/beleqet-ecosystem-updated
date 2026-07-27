import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import {
  prisma,
  employerToken,
  freelancerToken,
  adminToken,
  createTestUser,
  createTestEmployerWallet,
  createTestFreelancerWallet,
  createTestGig,
  createTestContract,
  createTestEscrow,
  cleanupAll,
} from '../../../../test/test-setup';

describe('Disputes Flow (e2e)', () => {
  let app: INestApplication;
  let employer: any;
  let freelancer: any;
  let admin: any;
  let employerAuthToken: string;
  let freelancerAuthToken: string;
  let adminAuthToken: string;
  let gig: any;
  let contract: any;
  let escrow: any;
  let disputeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    employer = await createTestUser({
      role: 'EMPLOYER',
      firstName: 'Dispute',
      lastName: 'Employer',
    });
    freelancer = await createTestUser({
      role: 'FREELANCER',
      firstName: 'Dispute',
      lastName: 'Freelancer',
    });
    admin = await createTestUser({ role: 'ADMIN', firstName: 'Dispute', lastName: 'Admin' });

    employerAuthToken = employerToken(employer.id, employer.email);
    freelancerAuthToken = freelancerToken(freelancer.id, freelancer.email);
    adminAuthToken = adminToken(admin.id, admin.email);

    await createTestEmployerWallet(employer.id, 20000);
    await createTestFreelancerWallet(freelancer.id);

    gig = await createTestGig(employer.id, { status: 'OPEN', budgetMax: 10000 });
    contract = await createTestContract(gig.id, employer.id, freelancer.id, 10000);

    escrow = await createTestEscrow(gig.id, {
      grossAmount: 10000,
      platformFee: 1000,
      netAmount: 9000,
      status: 'FUNDED',
      walletAppliedAmount: 10000,
    });

    await prisma.employerWallet.update({
      where: { userId: employer.id },
      data: {
        balance: { decrement: 10000 },
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.dispute.deleteMany();
    await cleanupAll();
    await app.close();
  });

  describe('POST /disputes', () => {
    it('should return 401 without JWT', () => {
      return request(app.getHttpServer())
        .post('/api/v1/disputes')
        .send({ contractId: contract.id, reason: 'Work is unacceptable' })
        .expect(401);
    });

    it('should create a dispute by employer', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/disputes')
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .send({
          contractId: contract.id,
          reason: 'Freelancer went unresponsive and work is not done.',
          evidenceUrls: ['http://example.com/evidence1.png'],
        })
        .expect(201);

      expect(res.body).toHaveProperty('success', true);

      const updatedContract = await prisma.contract.findUnique({ where: { id: contract.id } });
      expect(updatedContract!.status).toBe('DISPUTED');

      const updatedEscrow = await prisma.escrowTransaction.findUnique({ where: { id: escrow.id } });
      expect(updatedEscrow!.status).toBe('DISPUTED');

      const dispute = await prisma.dispute.findUnique({ where: { contractId: contract.id } });
      expect(dispute).not.toBeNull();
      disputeId = dispute!.id;
    });

    it('should return 400 when raising a dispute on an already disputed contract', async () => {
      return request(app.getHttpServer())
        .post('/api/v1/disputes')
        .set('Authorization', `Bearer ${freelancerAuthToken}`)
        .send({
          contractId: contract.id,
          reason: 'Client is lying.',
        })
        .expect(400);
    });
  });

  describe('GET /disputes/my', () => {
    it('should return disputes for user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/disputes/my')
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].contractId).toBe(contract.id);
    });
  });

  describe('GET /disputes/contract/:contractId', () => {
    it('should return dispute details for contract', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/disputes/contract/${contract.id}`)
        .set('Authorization', `Bearer ${freelancerAuthToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id', disputeId);
      expect(res.body.contractId).toBe(contract.id);
      expect(res.body.raisedBy.id).toBe(employer.id);
    });
  });

  describe('GET /disputes/all', () => {
    it('should return 403 for non-admin', () => {
      return request(app.getHttpServer())
        .get('/api/v1/disputes/all')
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(403);
    });

    it('should return all disputes for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/disputes/all')
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const dispute = res.body.find((d: any) => d.id === disputeId);
      expect(dispute).toBeDefined();
    });
  });

  describe('PATCH /disputes/:disputeId/resolve', () => {
    it('should return 403 for non-admin', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .send({
          resolution: 'Test resolution',
          resolutionType: 'SPLIT_50_50',
        })
        .expect(403);
    });

    it('should resolve dispute as admin (SPLIT_50_50)', async () => {
      const empWalletBefore = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });
      const freeWalletBefore = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .send({
          resolution: 'Admin determined both parties are at fault.',
          resolutionType: 'SPLIT_50_50',
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      const updatedDispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
      expect(updatedDispute!.resolvedAt).not.toBeNull();

      const updatedContract = await prisma.contract.findUnique({ where: { id: contract.id } });
      expect(updatedContract!.status).toBe('COMPLETED');

      const updatedEscrow = await prisma.escrowTransaction.findUnique({ where: { id: escrow.id } });
      expect(updatedEscrow!.status).toBe('RELEASED');

      const empWalletAfter = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });
      const freeWalletAfter = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });

      expect(empWalletAfter!.balance).toBe(empWalletBefore!.balance + 5000);
      expect(empWalletAfter!.lockedBalance).toBe(empWalletBefore!.lockedBalance);
      expect(freeWalletAfter!.pendingBalance).toBe(freeWalletBefore!.pendingBalance + 5000);
    });
  });

  describe('POST /disputes — evidenceUrls optional', () => {
    async function setupFreshContract(_role: 'EMPLOYER' | 'FREELANCER' = 'EMPLOYER') {
      const gig = await createTestGig(employer.id, { status: 'OPEN', budgetMax: 10000 });
      await createTestEscrow(gig.id, {
        grossAmount: 10000,
        platformFee: 1000,
        netAmount: 9000,
        status: 'FUNDED',
        walletAppliedAmount: 10000,
      });
      return createTestContract(gig.id, employer.id, freelancer.id, 10000);
    }

    it('accepts a payload where evidenceUrls is omitted (regression for @IsOptional bug)', async () => {
      const freshContract = await setupFreshContract();

      const res = await request(app.getHttpServer())
        .post('/api/v1/disputes')
        .set('Authorization', `Bearer ${freelancerAuthToken}`)
        .send({
          contractId: freshContract.id,
          reason: 'X'.repeat(50),
        })
        .expect(201);

      expect(res.body).toHaveProperty('success', true);

      const dispute = await prisma.dispute.findUnique({
        where: { contractId: freshContract.id },
      });
      expect(dispute).not.toBeNull();
      expect(dispute!.evidenceUrls).toEqual([]);
    });

    it('rejects when evidenceUrls is a string instead of an array', async () => {
      const freshContract = await setupFreshContract();

      return request(app.getHttpServer())
        .post('/api/v1/disputes')
        .set('Authorization', `Bearer ${freelancerAuthToken}`)
        .send({
          contractId: freshContract.id,
          reason: 'X'.repeat(50),
          evidenceUrls: 'https://example.com/x.pdf',
        })
        .expect(400)
        .expect((res) => {
          const messages = JSON.stringify(res.body);
          expect(messages).toMatch(/evidenceUrls/i);
        });
    });

    it('accepts when evidenceUrls is an explicit empty array', async () => {
      const freshContract = await setupFreshContract();

      return request(app.getHttpServer())
        .post('/api/v1/disputes')
        .set('Authorization', `Bearer ${freelancerAuthToken}`)
        .send({
          contractId: freshContract.id,
          reason: 'X'.repeat(50),
          evidenceUrls: [],
        })
        .expect(201);
    });
  });
});
