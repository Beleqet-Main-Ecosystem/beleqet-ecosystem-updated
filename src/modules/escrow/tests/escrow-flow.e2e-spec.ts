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
  createTestBid,
  createTestContract,
  createTestMilestone,
  createTestEscrow,
  trackEscrow,
  cleanupAll,
} from '../../../../test/test-setup';

describe('Escrow Flow (e2e)', () => {
  let app: INestApplication;
  let employer: any;
  let freelancer: any;
  let admin: any;
  let employerAuthToken: string;
  let freelancerAuthToken: string;
  let adminAuthToken: string;
  let gig: any;
  let contract: any;
  let milestone: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          data: { checkout_url: 'https://checkout.chapa.co/mock' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    employer = await createTestUser({
      role: 'EMPLOYER',
      firstName: 'Escrow',
      lastName: 'Employer',
    });
    freelancer = await createTestUser({
      role: 'FREELANCER',
      firstName: 'Escrow',
      lastName: 'Freelancer',
    });
    admin = await createTestUser({ role: 'ADMIN', firstName: 'Escrow', lastName: 'Admin' });
    employerAuthToken = employerToken(employer.id, employer.email);
    freelancerAuthToken = freelancerToken(freelancer.id, freelancer.email);
    adminAuthToken = adminToken(admin.id, admin.email);

    await createTestEmployerWallet(employer.id, 200000);
    await createTestFreelancerWallet(freelancer.id);

    gig = await createTestGig(employer.id, { status: 'OPEN', budgetMax: 10000 });
    contract = await createTestContract(gig.id, employer.id, freelancer.id, 10000);
    milestone = await createTestMilestone(contract.id, { amount: 10000, status: 'PENDING' });
  }, 30000);

  afterAll(async () => {
    await cleanupAll();
    await app.close();
  });

  describe('POST /escrow/initiate/:gigId', () => {
    it('should return 401 without JWT', () => {
      return request(app.getHttpServer()).post(`/api/v1/escrow/initiate/${gig.id}`).expect(401);
    });

    it('should initiate escrow (wallet-funded path)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/escrow/initiate/${gig.id}`)
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('escrowId');
      expect(res.body.checkoutUrl).toBeNull();
      expect(res.body.grossAmount).toBe(10000);
      expect(res.body.walletAppliedAmount).toBe(10000);

      const wallet = await prisma.employerWallet.findUnique({ where: { userId: employer.id } });
      expect(wallet!.balance).toBe(190000);
      expect(wallet!.lockedBalance).toBe(0);

      const escrow = await prisma.escrowTransaction.findUnique({
        where: { id: res.body.escrowId },
      });
      expect(escrow!.status).toBe('FUNDED');
    });
  });

  describe('POST /escrow/initiate/:gigId (partial wallet + Chapa)', () => {
    let lowBalanceEmployer: any;
    let lowBalanceToken: string;
    let partialGig: any;
    let partialContract: any;

    beforeAll(async () => {
      lowBalanceEmployer = await createTestUser({
        role: 'EMPLOYER',
        firstName: 'LowBal',
        lastName: 'Employer',
      });
      lowBalanceToken = employerToken(lowBalanceEmployer.id, lowBalanceEmployer.email);
      await createTestEmployerWallet(lowBalanceEmployer.id, 3000);

      partialGig = await createTestGig(lowBalanceEmployer.id, { status: 'OPEN', budgetMax: 10000 });
      partialContract = await createTestContract(
        partialGig.id,
        lowBalanceEmployer.id,
        freelancer.id,
        10000,
      );
    });

    it('should initiate escrow with partial wallet and Chapa checkout URL', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/escrow/initiate/${partialGig.id}`)
        .set('Authorization', `Bearer ${lowBalanceToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('escrowId');
      expect(res.body.checkoutUrl).toBe('https://checkout.chapa.co/mock');
      expect(res.body.walletAppliedAmount).toBe(3000);
      expect(res.body.amountToPay).toBe(7000);

      const wallet = await prisma.employerWallet.findUnique({
        where: { userId: lowBalanceEmployer.id },
      });
      expect(wallet!.balance).toBe(0);
      expect(wallet!.lockedBalance).toBe(3000);

      const escrow = await prisma.escrowTransaction.findUnique({
        where: { id: res.body.escrowId },
      });
      expect(escrow!.status).toBe('PENDING');
    });
  });

  describe('POST /escrow/callback', () => {
    let pendingEscrow: any;
    let testGatewayRef: string;

    beforeAll(async () => {
      const webhookGig = await createTestGig(employer.id, { status: 'OPEN', budgetMax: 5000 });
      pendingEscrow = await createTestEscrow(webhookGig.id, {
        grossAmount: 5000,
        status: 'PENDING',
        walletAppliedAmount: 0,
      });
      testGatewayRef = pendingEscrow.gatewayRef;
    });

    it('should process webhook and fund escrow', async () => {
      const payload = {
        tx_ref: `tx-ref-${Date.now()}`,
        reference: testGatewayRef,
        status: 'success',
        amount: 5000,
        currency: 'ETB',
        timestamp: new Date().toISOString(),
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/escrow/callback')
        .send(payload)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);

      await new Promise((r) => setTimeout(r, 3000));

      const escrow = await prisma.escrowTransaction.findUnique({ where: { id: pendingEscrow.id } });
      expect(escrow!.status).toBe('FUNDED');
      expect(escrow!.fundedAt).not.toBeNull();

      const job = await prisma.freelanceJob.findUnique({
        where: { id: pendingEscrow.freelanceJobId },
      });
      expect(job!.status).toBe('FUNDED');
    });

    it('should be idempotent for already FUNDED escrow', async () => {
      const payload = {
        tx_ref: `tx-ref-dup-${Date.now()}`,
        reference: testGatewayRef,
        status: 'success',
        amount: 5000,
        currency: 'ETB',
        timestamp: new Date().toISOString(),
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/escrow/callback')
        .send(payload)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);

      await new Promise((r) => setTimeout(r, 1000));
      const escrow = await prisma.escrowTransaction.findUnique({ where: { id: pendingEscrow.id } });
      expect(escrow!.status).toBe('FUNDED');
    });
  });

  describe('POST /escrow/callback (failure path)', () => {
    let failureEscrow: any;
    let failureGig: any;

    beforeAll(async () => {
      failureGig = await createTestGig(employer.id, { status: 'OPEN', budgetMax: 8000 });
      failureEscrow = await createTestEscrow(failureGig.id, {
        grossAmount: 8000,
        status: 'PENDING',
        walletAppliedAmount: 8000,
      });

      await prisma.employerWallet.update({
        where: { userId: employer.id },
        data: { balance: { decrement: 8000 }, lockedBalance: { increment: 8000 } },
      });
    });

    it('should set escrow to REFUNDED and unlock wallet funds on failure', async () => {
      const walletBefore = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });

      const payload = {
        tx_ref: `tx-ref-fail-${Date.now()}`,
        reference: failureEscrow.gatewayRef,
        status: 'failure',
        amount: 8000,
        currency: 'ETB',
        timestamp: new Date().toISOString(),
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/escrow/callback')
        .send(payload)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);

      await new Promise((r) => setTimeout(r, 3000));

      const escrow = await prisma.escrowTransaction.findUnique({ where: { id: failureEscrow.id } });
      expect(escrow!.status).toBe('REFUNDED');

      const walletAfter = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });
      expect(walletAfter!.lockedBalance).toBe(walletBefore!.lockedBalance - 8000);
      expect(walletAfter!.balance).toBe(walletBefore!.balance + 8000);
    });
  });

  describe('POST /escrow/milestones/:id/release', () => {
    it('should return 401 without JWT', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/escrow/milestones/${milestone.id}/release`)
        .expect(401);
    });

    it('should return 403 for non-contract-owner', async () => {
      const otherUser = await createTestUser({
        role: 'EMPLOYER',
        firstName: 'Other',
        lastName: 'Employer',
      });
      const otherToken = employerToken(otherUser.id, otherUser.email);

      return request(app.getHttpServer())
        .post(`/api/v1/escrow/milestones/${milestone.id}/release`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(404);
    });

    it('should release milestone (submit then approve)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/freelance/milestones/${milestone.id}/submit`)
        .set('Authorization', `Bearer ${freelancerAuthToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/escrow/milestones/${milestone.id}/release`)
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('success', true);

      const updated = await prisma.milestone.findUnique({ where: { id: milestone.id } });
      expect(updated!.status).toBe('APPROVED');
      expect(updated!.approvedAt).not.toBeNull();

      const fw = await prisma.freelancerWallet.findUnique({ where: { userId: freelancer.id } });
      expect(fw!.pendingBalance).toBeGreaterThan(0);
    });

    it('should return 400 if milestone already APPROVED', async () => {
      return request(app.getHttpServer())
        .post(`/api/v1/escrow/milestones/${milestone.id}/release`)
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(400);
    });
  });

  describe('PATCH /freelance/milestones/:id/request-revision', () => {
    let revisionMilestone: any;
    let revisionContract: any;
    let revisionGig: any;

    beforeAll(async () => {
      revisionGig = await createTestGig(employer.id, { status: 'FUNDED', budgetMax: 6000 });
      revisionContract = await createTestContract(revisionGig.id, employer.id, freelancer.id, 6000);
      revisionMilestone = await createTestMilestone(revisionContract.id, {
        amount: 6000,
        status: 'PENDING',
      });
      await createTestEscrow(revisionGig.id, {
        grossAmount: 6000,
        platformFee: 600,
        netAmount: 5400,
        status: 'FUNDED',
        walletAppliedAmount: 6000,
      });
    });

    it('should submit milestone as freelancer', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/freelance/milestones/${revisionMilestone.id}/submit`)
        .set('Authorization', `Bearer ${freelancerAuthToken}`)
        .expect(200);

      const m = await prisma.milestone.findUnique({ where: { id: revisionMilestone.id } });
      expect(m!.status).toBe('SUBMITTED');
    });

    it('should request revision as employer', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/freelance/milestones/${revisionMilestone.id}/request-revision`)
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .send({ reason: 'Please make changes to the work' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);

      const m = await prisma.milestone.findUnique({ where: { id: revisionMilestone.id } });
      expect(m!.status).toBe('REVISION_REQUESTED');
      expect(m!.revisionNotes).toBe('Please make changes to the work');
    });

    it('should resubmit milestone after revision', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/freelance/milestones/${revisionMilestone.id}/submit`)
        .set('Authorization', `Bearer ${freelancerAuthToken}`)
        .expect(200);

      const m = await prisma.milestone.findUnique({ where: { id: revisionMilestone.id } });
      expect(m!.status).toBe('SUBMITTED');
    });

    it('should approve milestone after resubmit', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/escrow/milestones/${revisionMilestone.id}/release`)
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('success', true);

      const m = await prisma.milestone.findUnique({ where: { id: revisionMilestone.id } });
      expect(m!.status).toBe('APPROVED');
    });
  });

  describe('POST /escrow/admin/:id/force-release', () => {
    let forceReleaseGig: any;
    let forceReleaseContract: any;
    let forceReleaseEscrow: any;

    beforeAll(async () => {
      forceReleaseGig = await createTestGig(employer.id, { status: 'FUNDED', budgetMax: 12000 });
      forceReleaseContract = await createTestContract(
        forceReleaseGig.id,
        employer.id,
        freelancer.id,
        12000,
      );
      forceReleaseEscrow = await createTestEscrow(forceReleaseGig.id, {
        grossAmount: 12000,
        platformFee: 1200,
        netAmount: 10800,
        status: 'FUNDED',
        walletAppliedAmount: 12000,
      });
    });

    it('should return 403 for non-admin', async () => {
      return request(app.getHttpServer())
        .post(`/api/v1/escrow/admin/${forceReleaseEscrow.id}/force-release`)
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(403);
    });

    it('should force release escrow as admin', async () => {
      const freeWalletBefore = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });
      const pendingBefore = freeWalletBefore?.pendingBalance || 0;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/escrow/admin/${forceReleaseEscrow.id}/force-release`)
        .set('Authorization', `Bearer ${adminAuthToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('autoReleaseQueued', true);

      const escrow = await prisma.escrowTransaction.findUnique({
        where: { id: forceReleaseEscrow.id },
      });
      expect(escrow!.status).toBe('RELEASED');
      expect(escrow!.releasedAt).not.toBeNull();

      const freeWalletAfter = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });
      expect(freeWalletAfter!.pendingBalance).toBeGreaterThan(pendingBefore);
    });
  });

  describe('GET /escrow/summary and /escrow/freelancer/summary', () => {
    it('should return employer escrow summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/escrow/summary')
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('totalEscrows');
      expect(res.body).toHaveProperty('activeEscrows');
      expect(res.body.totalEscrows).toBeGreaterThan(0);
    });

    it('should return freelancer escrow summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/escrow/freelancer/summary')
        .set('Authorization', `Bearer ${freelancerAuthToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('totalEarned');
      expect(res.body).toHaveProperty('activeEscrows');
      expect(res.body.totalEarned).toBeGreaterThan(0);
    });

    it('should return 401 without JWT for employer summary', () => {
      return request(app.getHttpServer()).get('/api/v1/escrow/summary').expect(401);
    });

    it('should return 401 without JWT for freelancer summary', () => {
      return request(app.getHttpServer()).get('/api/v1/escrow/freelancer/summary').expect(401);
    });
  });

  describe('DELETE /escrow/:escrowId/cancel', () => {
    let cancellableEscrow: any;

    beforeAll(async () => {
      const cancelGig = await createTestGig(employer.id, { status: 'OPEN', budgetMax: 8000 });
      cancellableEscrow = await createTestEscrow(cancelGig.id, {
        grossAmount: 8000,
        status: 'FUNDED',
        walletAppliedAmount: 8000,
      });

      await prisma.employerWallet.update({
        where: { userId: employer.id },
        data: { balance: { decrement: 8000 }, lockedBalance: { increment: 8000 } },
      });
    });

    it('should return 401 without JWT', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/escrow/${cancellableEscrow.id}/cancel`)
        .expect(401);
    });

    it('should cancel escrow and refund wallet', async () => {
      const walletBefore = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });
      const lockedBefore = walletBefore!.lockedBalance;

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/escrow/${cancellableEscrow.id}/cancel`)
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.refundedAmount).toBe(8000);

      const escrow = await prisma.escrowTransaction.findUnique({
        where: { id: cancellableEscrow.id },
      });
      expect(escrow!.status).toBe('REFUNDED');
    });

    it('should return 400 for already cancelled escrow', async () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/escrow/${cancellableEscrow.id}/cancel`)
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(400);
    });
  });

  describe('POST /escrow/contracts/:contractId/complete', () => {
    let completeGig: any;
    let completeContract: any;
    let completeEscrow: any;
    let completeMilestone: any;

    beforeAll(async () => {
      completeGig = await createTestGig(employer.id, { status: 'FUNDED', budgetMax: 7000 });
      completeContract = await createTestContract(completeGig.id, employer.id, freelancer.id, 7000);
      completeEscrow = await createTestEscrow(completeGig.id, {
        grossAmount: 7000,
        platformFee: 700,
        netAmount: 6300,
        status: 'FUNDED',
        walletAppliedAmount: 7000,
      });
      completeMilestone = await createTestMilestone(completeContract.id, {
        amount: 7000,
        status: 'APPROVED',
      });
    });

    it('should return 401 without JWT', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/escrow/contracts/${completeContract.id}/complete`)
        .expect(401);
    });

    it('should complete contract, update escrow and notify', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/escrow/contracts/${completeContract.id}/complete`)
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(201);

      expect(res.body).toHaveProperty('success', true);

      const contract = await prisma.contract.findUnique({ where: { id: completeContract.id } });
      expect(contract!.status).toBe('COMPLETED');
      expect(contract!.completedAt).not.toBeNull();

      const escrow = await prisma.escrowTransaction.findUnique({
        where: { id: completeEscrow.id },
      });
      expect(escrow!.status).toBe('RELEASED');

      const job = await prisma.freelanceJob.findUnique({ where: { id: completeGig.id } });
      expect(job!.status).toBe('COMPLETED');
    });

    it('should return 400 for already completed contract', async () => {
      return request(app.getHttpServer())
        .post(`/api/v1/escrow/contracts/${completeContract.id}/complete`)
        .set('Authorization', `Bearer ${employerAuthToken}`)
        .expect(400);
    });
  });
});
