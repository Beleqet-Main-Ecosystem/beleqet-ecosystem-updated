import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EscrowService } from '@modules/escrow/escrow.service';
import { WalletService } from '@modules/wallet/wallet.service';
import { PrismaService } from '@prisma-client';
import { CryptoService } from '@common/crypto/crypto.service';
import { ICURRENCY_CONVERTER } from '@common/currency/currency-converter.interface';
import { QUEUE_NAMES, ESCROW_JOBS, NOTIFICATION_JOBS } from '@modules/queues/queues.constants';

import {
  prisma,
  createTestUser,
  createTestEmployerWallet,
  createTestFreelancerWallet,
  createTestGig,
  createTestContract,
  createTestMilestone,
  createTestEscrow,
  cleanupAll,
} from '../../../../test/test-setup';

describe('Escrow ↔ Wallet Integration', () => {
  let escrowService: EscrowService;
  let appPrisma: PrismaService;

  const mockEscrowQueue = { add: jest.fn().mockResolvedValue(undefined) };
  const mockNotificationsQueue = { add: jest.fn().mockResolvedValue(undefined) };

  let employer: any;
  let freelancer: any;

  beforeAll(async () => {
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

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        WalletService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, any> = {
                CHAPA_SECRET_KEY: 'test-secret',
                CHAPA_CALLBACK_URL: 'http://localhost/callback',
                CHAPA_RETURN_URL: 'http://localhost/return',
                FRONTEND_URL: 'http://localhost',
                PLATFORM_FEE_PCT: 0.1,
                AUTO_RELEASE_HOURS: 72,
              };
              return map[key];
            }),
          },
        },
        {
          provide: CryptoService,
          useValue: {
            encrypt: (s: string) => s,
            decrypt: (s: string) => s,
            safeDecrypt: (s: string) => s,
            isEncrypted: () => false,
          },
        },
        {
          provide: ICURRENCY_CONVERTER,
          useValue: {
            convert: (a: number) => a,
            getRate: () => 1,
            supportedCurrencies: () => ['ETB'],
          },
        },
        { provide: `BullQueue_${QUEUE_NAMES.ESCROW}`, useValue: mockEscrowQueue },
        { provide: `BullQueue_${QUEUE_NAMES.NOTIFICATIONS}`, useValue: mockNotificationsQueue },
      ],
    }).compile();

    appPrisma = moduleFixture.get(PrismaService);
    escrowService = moduleFixture.get(EscrowService);

    employer = await createTestUser({ role: 'EMPLOYER', firstName: 'Int', lastName: 'Employer' });
    freelancer = await createTestUser({
      role: 'FREELANCER',
      firstName: 'Int',
      lastName: 'Freelancer',
    });
    await createTestEmployerWallet(employer.id, 100000);
    await createTestFreelancerWallet(freelancer.id);
  }, 30000);

  afterAll(async () => {
    await cleanupAll();
  });

  describe('initiate — fully wallet-funded', () => {
    it('should debit wallet, escrow FUNDED, eventLog escrow.funded, notify', async () => {
      const gig = await createTestGig(employer.id, { status: 'OPEN', budgetMax: 10000 });
      await createTestContract(gig.id, employer.id, freelancer.id, 10000);

      const walletBefore = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });

      const result = await escrowService.initiate(employer.id, gig.id);

      expect(result.walletAppliedAmount).toBe(10000);
      expect(result.checkoutUrl).toBeNull();

      const walletAfter = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });
      expect(walletAfter!.balance).toBe(walletBefore!.balance - 10000);

      const escrow = await prisma.escrowTransaction.findUnique({ where: { id: result.escrowId } });
      expect(escrow!.status).toBe('FUNDED');

      const job = await prisma.freelanceJob.findUnique({ where: { id: gig.id } });
      expect(job!.status).toBe('FUNDED');

      const eventLog = await prisma.eventLog.findFirst({
        where: { entityId: result.escrowId, eventType: 'escrow.funded' },
      });
      expect(eventLog).not.toBeNull();
      expect(eventLog!.payload).toHaveProperty('amount', 10000);

      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_IN_APP,
        expect.objectContaining({ userId: employer.id, type: 'escrow.funded' }),
      );
    });
  });

  describe('initiate — partial wallet + Chapa', () => {
    it('should lock wallet, return checkout URL, schedule UNLOCK_FUNDS', async () => {
      const lowEmployer = await createTestUser({
        role: 'EMPLOYER',
        firstName: 'Low',
        lastName: 'Bal',
      });
      await createTestEmployerWallet(lowEmployer.id, 3000);
      const partialGig = await createTestGig(lowEmployer.id, { status: 'OPEN', budgetMax: 10000 });
      await createTestContract(partialGig.id, lowEmployer.id, freelancer.id, 10000);

      const result = await escrowService.initiate(lowEmployer.id, partialGig.id);

      expect(result.walletAppliedAmount).toBe(3000);
      expect(result.amountToPay).toBe(7000);
      expect(result.checkoutUrl).toBe('https://checkout.chapa.co/mock');

      const wallet = await prisma.employerWallet.findUnique({ where: { userId: lowEmployer.id } });
      expect(wallet!.balance).toBe(0);
      expect(wallet!.lockedBalance).toBe(3000);

      const escrow = await prisma.escrowTransaction.findUnique({ where: { id: result.escrowId } });
      expect(escrow!.status).toBe('PENDING');

      expect(mockEscrowQueue.add).toHaveBeenCalledWith(
        ESCROW_JOBS.UNLOCK_FUNDS,
        expect.objectContaining({ amount: 3000 }),
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });
  });

  describe('cancelEscrow — FUNDED state', () => {
    it('should refund wallet, set REFUNDED, queue CANCEL_CHAPA', async () => {
      const cancelGig = await createTestGig(employer.id, { status: 'OPEN', budgetMax: 8000 });
      await createTestContract(cancelGig.id, employer.id, freelancer.id, 8000);
      const fundedEscrow = await createTestEscrow(cancelGig.id, {
        grossAmount: 8000,
        platformFee: 800,
        netAmount: 7200,
        status: 'FUNDED',
        walletAppliedAmount: 6000,
      });
      await prisma.employerWallet.update({
        where: { userId: employer.id },
        data: { balance: { decrement: 6000 }, lockedBalance: { increment: 6000 } },
      });

      const walletBefore = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });

      const result = await escrowService.cancelEscrow(fundedEscrow.id, employer.id);

      expect(result.refundedAmount).toBe(6000);
      expect(result.success).toBe(true);

      const walletAfter = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });
      expect(walletAfter!.balance).toBe(walletBefore!.balance + 6000);

      const escrow = await prisma.escrowTransaction.findUnique({ where: { id: fundedEscrow.id } });
      expect(escrow!.status).toBe('REFUNDED');

      const job = await prisma.freelanceJob.findUnique({ where: { id: cancelGig.id } });
      expect(job!.status).toBe('DRAFT');

      expect(mockEscrowQueue.add).toHaveBeenCalledWith(
        ESCROW_JOBS.CANCEL_CHAPA_PAYMENT,
        expect.objectContaining({ escrowId: fundedEscrow.id }),
      );
    });
  });

  describe('cancelEscrow — PENDING state', () => {
    it('should unlock locked balance and set REFUNDED', async () => {
      const pendingGig = await createTestGig(employer.id, { status: 'OPEN', budgetMax: 6000 });
      await createTestContract(pendingGig.id, employer.id, freelancer.id, 6000);
      const pendingEscrow = await createTestEscrow(pendingGig.id, {
        grossAmount: 6000,
        platformFee: 600,
        netAmount: 5400,
        status: 'PENDING',
        walletAppliedAmount: 6000,
      });
      await prisma.employerWallet.update({
        where: { userId: employer.id },
        data: { lockedBalance: { increment: 6000 } },
      });

      const walletBefore = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });

      await escrowService.cancelEscrow(pendingEscrow.id, employer.id);

      const walletAfter = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });
      expect(walletAfter!.lockedBalance).toBe(walletBefore!.lockedBalance - 6000);
      expect(walletAfter!.balance).toBe(walletBefore!.balance + 6000);

      const escrow = await prisma.escrowTransaction.findUnique({ where: { id: pendingEscrow.id } });
      expect(escrow!.status).toBe('REFUNDED');
    });
  });

  describe('releaseMilestone', () => {
    it('should reject if not SUBMITTED, then approve, credit wallet, queue AUTO_RELEASE, log event', async () => {
      const releaseGig = await createTestGig(employer.id, { status: 'FUNDED', budgetMax: 15000 });
      const releaseContract = await createTestContract(
        releaseGig.id,
        employer.id,
        freelancer.id,
        15000,
      );
      await createTestEscrow(releaseGig.id, {
        grossAmount: 15000,
        platformFee: 1500,
        netAmount: 13500,
        status: 'FUNDED',
        walletAppliedAmount: 15000,
      });
      const releaseMilestone = await createTestMilestone(releaseContract.id, {
        amount: 15000,
        status: 'PENDING',
      });

      await expect(
        escrowService.releaseMilestone(releaseMilestone.id, employer.id),
      ).rejects.toThrow('Milestone must be in SUBMITTED status');

      await appPrisma.milestone.update({
        where: { id: releaseMilestone.id },
        data: { status: 'SUBMITTED' },
      });

      const freeWalletBefore = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });
      const pendingBefore = freeWalletBefore?.pendingBalance || 0;

      const result = await escrowService.releaseMilestone(releaseMilestone.id, employer.id);
      expect(result.success).toBe(true);

      const milestone = await appPrisma.milestone.findUnique({
        where: { id: releaseMilestone.id },
      });
      expect(milestone!.status).toBe('APPROVED');
      expect(milestone!.approvedAt).not.toBeNull();

      const freeWalletAfter = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });
      expect(freeWalletAfter!.pendingBalance).toBe(pendingBefore + 15000);

      expect(mockEscrowQueue.add).toHaveBeenCalledWith(
        ESCROW_JOBS.AUTO_RELEASE,
        expect.objectContaining({ milestoneId: releaseMilestone.id, amount: 15000 }),
        expect.objectContaining({ jobId: expect.stringContaining(releaseMilestone.id) }),
      );

      const eventLog = await prisma.eventLog.findFirst({
        where: { entityId: releaseMilestone.id, eventType: 'milestone.approved' },
      });
      expect(eventLog).not.toBeNull();
      expect(eventLog!.payload).toMatchObject({ milestoneId: releaseMilestone.id });
    });
  });

  describe('completeContract', () => {
    it('should complete contract, release escrow, update job, notify', async () => {
      const completeGig = await createTestGig(employer.id, { status: 'FUNDED', budgetMax: 20000 });
      const completeContract = await createTestContract(
        completeGig.id,
        employer.id,
        freelancer.id,
        20000,
      );
      const completeEscrow = await createTestEscrow(completeGig.id, {
        grossAmount: 20000,
        platformFee: 2000,
        netAmount: 18000,
        status: 'FUNDED',
        walletAppliedAmount: 20000,
      });
      await createTestMilestone(completeContract.id, { amount: 20000, status: 'APPROVED' });

      const result = await escrowService.completeContract(completeContract.id, employer.id);
      expect(result.success).toBe(true);

      const contract = await appPrisma.contract.findUnique({ where: { id: completeContract.id } });
      expect(contract!.status).toBe('COMPLETED');
      expect(contract!.completedAt).not.toBeNull();

      const escrow = await appPrisma.escrowTransaction.findUnique({
        where: { id: completeEscrow.id },
      });
      expect(escrow!.status).toBe('RELEASED');
      expect(escrow!.releasedAt).not.toBeNull();

      const job = await appPrisma.freelanceJob.findUnique({ where: { id: completeGig.id } });
      expect(job!.status).toBe('COMPLETED');

      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_IN_APP,
        expect.objectContaining({ type: 'contract.completed', userId: employer.id }),
      );
      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_IN_APP,
        expect.objectContaining({ type: 'contract.completed', userId: freelancer.id }),
      );
    });
  });

  describe('adminForceRelease', () => {
    it('should force release, credit freelancer, queue auto-release', async () => {
      const forceGig = await createTestGig(employer.id, { status: 'FUNDED', budgetMax: 25000 });
      await createTestContract(forceGig.id, employer.id, freelancer.id, 25000);
      const forceEscrow = await createTestEscrow(forceGig.id, {
        grossAmount: 25000,
        platformFee: 2500,
        netAmount: 22500,
        status: 'FUNDED',
        walletAppliedAmount: 25000,
      });

      const freeWalletBefore = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });

      const result = await escrowService.adminForceRelease(forceEscrow.id, 'admin-user');
      expect(result.success).toBe(true);
      expect(result.autoReleaseQueued).toBe(true);

      const escrow = await appPrisma.escrowTransaction.findUnique({
        where: { id: forceEscrow.id },
      });
      expect(escrow!.status).toBe('RELEASED');

      const freeWalletAfter = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });
      expect(freeWalletAfter!.pendingBalance).toBeGreaterThan(freeWalletBefore!.pendingBalance);
    });
  });

  describe('transactional invariants', () => {
    it('should reject initiate for non-existent gig', async () => {
      await expect(
        escrowService.initiate(employer.id, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow();
    });

    it('should reject release for non-existent milestone', async () => {
      await expect(
        escrowService.releaseMilestone('00000000-0000-0000-0000-000000000000', employer.id),
      ).rejects.toThrow('Milestone not found');
    });

    it('should reject cancel for non-owned escrow', async () => {
      const otherUser = await createTestUser({
        role: 'EMPLOYER',
        firstName: 'Other',
        lastName: 'Int',
      });
      const otherGig = await createTestGig(otherUser.id, { status: 'OPEN', budgetMax: 1000 });
      await createTestContract(otherGig.id, otherUser.id, freelancer.id, 1000);
      const otherEscrow = await createTestEscrow(otherGig.id, {
        grossAmount: 1000,
        status: 'PENDING',
        walletAppliedAmount: 0,
      });

      await expect(escrowService.cancelEscrow(otherEscrow.id, employer.id)).rejects.toThrow();
    });

    it('should enforce platform fee = 10% of gross', async () => {
      const feeGig = await createTestGig(employer.id, { status: 'OPEN', budgetMax: 5000 });
      await createTestContract(feeGig.id, employer.id, freelancer.id, 5000);

      const result = await escrowService.initiate(employer.id, feeGig.id);

      const escrow = await prisma.escrowTransaction.findUnique({ where: { id: result.escrowId } });
      expect(escrow!.platformFee).toBe(500);
      expect(escrow!.netAmount).toBe(4500);
      expect(escrow!.grossAmount).toBe(escrow!.platformFee + escrow!.netAmount);
    });
  });
});
