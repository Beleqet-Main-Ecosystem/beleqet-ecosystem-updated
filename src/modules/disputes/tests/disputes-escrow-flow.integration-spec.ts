import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES, ESCROW_JOBS, NOTIFICATION_JOBS } from '@modules/queues/queues.constants';
import { PrismaService } from '@prisma-client';
import { DisputesService } from '@modules/disputes/disputes.service';
import {
  prisma,
  createTestUser,
  createTestEmployerWallet,
  createTestFreelancerWallet,
  createTestGig,
  createTestContract,
  createTestEscrow,
  trackDispute,
  cleanupAll,
} from '../../../../test/test-setup';
import * as crypto from 'crypto';

describe('Disputes ↔ Escrow Integration', () => {
  let module: TestingModule;
  let disputesService: DisputesService;
  let mockEscrowQueue: { add: jest.Mock };
  let mockNotificationsQueue: { add: jest.Mock };

  beforeAll(async () => {
    mockEscrowQueue = { add: jest.fn().mockResolvedValue({ id: 'mock-job' }) };
    mockNotificationsQueue = { add: jest.fn().mockResolvedValue({ id: 'mock-notif' }) };

    module = await Test.createTestingModule({
      providers: [
        DisputesService,
        PrismaService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-value') },
        },
        {
          provide: getQueueToken(QUEUE_NAMES.ESCROW),
          useValue: mockEscrowQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS),
          useValue: mockNotificationsQueue,
        },
      ],
    }).compile();

    disputesService = module.get(DisputesService);
  });

  afterAll(async () => {
    await cleanupAll();
    await module?.close();
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function setupFundedEscrow() {
    const employer = await createTestUser({
      role: 'EMPLOYER',
      firstName: 'Dispute',
      lastName: 'Client',
    });
    const freelancer = await createTestUser({
      role: 'FREELANCER',
      firstName: 'Dispute',
      lastName: 'Freelancer',
    });
    const admin = await createTestUser({ role: 'ADMIN', firstName: 'Dispute', lastName: 'Admin' });
    await createTestEmployerWallet(employer.id, 50000);
    await createTestFreelancerWallet(freelancer.id);
    const gig = await createTestGig(employer.id, { budgetMax: 50000 });
    const contract = await createTestContract(gig.id, employer.id, freelancer.id, 30000);
    const escrow = await createTestEscrow(gig.id, {
      grossAmount: 30000,
      walletAppliedAmount: 30000,
      status: 'FUNDED',
    });
    return { employer, freelancer, admin, gig, contract, escrow };
  }

  async function createAndTrackDispute(contractId: string, userId: string) {
    await disputesService.createDispute(userId, { contractId, reason: 'X'.repeat(50) });
    const dispute = await prisma.dispute.findUnique({ where: { contractId } });
    if (dispute) trackDispute(dispute.id);
    return dispute!;
  }

  describe('createDispute', () => {
    it('should create dispute, set contract DISPUTED, set escrow DISPUTED, log event, notify', async () => {
      const { employer, freelancer, _gig, contract, escrow } = await setupFundedEscrow();

      const result = await disputesService.createDispute(freelancer.id, {
        contractId: contract.id,
        reason: 'X'.repeat(50),
      });

      expect(result.success).toBe(true);

      const dispute = await prisma.dispute.findUnique({ where: { contractId: contract.id } });
      expect(dispute).toBeDefined();
      expect(dispute!.raisedById).toBe(freelancer.id);
      trackDispute(dispute!.id);

      const updatedContract = await prisma.contract.findUnique({ where: { id: contract.id } });
      expect(updatedContract!.status).toBe('DISPUTED');

      const updatedEscrow = await prisma.escrowTransaction.findUnique({ where: { id: escrow.id } });
      expect(updatedEscrow!.status).toBe('DISPUTED');

      const eventLog = await prisma.eventLog.findFirst({
        where: { entityId: dispute!.id, eventType: 'dispute.raised' },
      });
      expect(eventLog).toBeDefined();
      expect(eventLog!.payload).toMatchObject({ contractId: contract.id, raisedBy: freelancer.id });

      const notificationCalls = mockNotificationsQueue.add.mock.calls.filter(
        (c: any[]) => c[0] === NOTIFICATION_JOBS.SEND_IN_APP,
      );
      expect(notificationCalls.length).toBeGreaterThanOrEqual(1);
      const notifiedUserIds = notificationCalls.map((c: any[]) => c[1].userId);
      expect(notifiedUserIds).toContain(employer.id);
    });

    it('should reject if contract not found or user is not a party', async () => {
      const { freelancer } = await setupFundedEscrow();
      const fakeId = crypto.randomUUID();

      await expect(
        disputesService.createDispute(freelancer.id, {
          contractId: fakeId,
          reason: 'X'.repeat(50),
        }),
      ).rejects.toThrow('Contract not found');
    });

    it('should reject duplicate dispute on same contract', async () => {
      const { employer, freelancer, contract } = await setupFundedEscrow();

      const _dispute = await createAndTrackDispute(contract.id, freelancer.id);

      await expect(
        disputesService.createDispute(employer.id, {
          contractId: contract.id,
          reason: 'Y'.repeat(50),
        }),
      ).rejects.toThrow('already exists');
    });

    it('should reject if contract is not ACTIVE or DISPUTED', async () => {
      const { freelancer, contract } = await setupFundedEscrow();
      await prisma.contract.update({ where: { id: contract.id }, data: { status: 'COMPLETED' } });

      await expect(
        disputesService.createDispute(freelancer.id, {
          contractId: contract.id,
          reason: 'X'.repeat(50),
        }),
      ).rejects.toThrow('active contracts');
    });
  });

  describe('resolveDispute — RELEASE_TO_FREELANCER', () => {
    it('should release full net amount to freelancer, set escrow RELEASED, complete contract', async () => {
      const { _employer, freelancer, admin, contract, escrow } = await setupFundedEscrow();
      const dispute = await createAndTrackDispute(contract.id, freelancer.id);

      const walletBefore = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });

      await disputesService.resolveDispute(
        dispute.id,
        'Resolved in favor of freelancer',
        'RELEASE_TO_FREELANCER',
        admin.id,
      );

      const walletAfter = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });
      expect(walletAfter!.pendingBalance).toBe(walletBefore!.pendingBalance + escrow.netAmount);

      const escrowAfter = await prisma.escrowTransaction.findUnique({ where: { id: escrow.id } });
      expect(escrowAfter!.status).toBe('RELEASED');

      const contractAfter = await prisma.contract.findUnique({ where: { id: contract.id } });
      expect(contractAfter!.status).toBe('COMPLETED');

      expect(mockNotificationsQueue.add).toHaveBeenCalled();
      expect(mockEscrowQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('resolveDispute — REFUND_TO_CLIENT', () => {
    it('should refund wallet, set escrow REFUNDED', async () => {
      const { employer, freelancer, admin, contract, escrow } = await setupFundedEscrow();
      const dispute = await createAndTrackDispute(contract.id, freelancer.id);

      const walletBefore = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });

      await disputesService.resolveDispute(
        dispute.id,
        'Resolved — refund to client',
        'REFUND_TO_CLIENT',
        admin.id,
      );

      const walletAfter = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });
      expect(walletAfter!.balance).toBe(walletBefore!.balance + escrow.walletAppliedAmount);

      const escrowAfter = await prisma.escrowTransaction.findUnique({ where: { id: escrow.id } });
      expect(escrowAfter!.status).toBe('REFUNDED');

      expect(mockEscrowQueue.add).not.toHaveBeenCalled();
    });

    it('should queue CANCEL_CHAPA_PAYMENT when Chapa was used', async () => {
      const employer = await createTestUser({
        role: 'EMPLOYER',
        firstName: 'Chapa',
        lastName: 'Client',
      });
      const freelancer = await createTestUser({
        role: 'FREELANCER',
        firstName: 'Chapa',
        lastName: 'Worker',
      });
      const admin = await createTestUser({ role: 'ADMIN', firstName: 'Chapa', lastName: 'Admin' });
      await createTestEmployerWallet(employer.id, 50000);
      await createTestFreelancerWallet(freelancer.id);
      const gig = await createTestGig(employer.id, { budgetMax: 50000 });
      const contract = await createTestContract(gig.id, employer.id, freelancer.id, 50000);
      await createTestEscrow(gig.id, {
        grossAmount: 50000,
        walletAppliedAmount: 10000,
        status: 'FUNDED',
      });
      const dispute = await createAndTrackDispute(contract.id, freelancer.id);

      await disputesService.resolveDispute(
        dispute.id,
        'Refund — Chapa was used',
        'REFUND_TO_CLIENT',
        admin.id,
      );

      expect(mockEscrowQueue.add).toHaveBeenCalledWith(
        ESCROW_JOBS.CANCEL_CHAPA_PAYMENT,
        expect.objectContaining({ escrowId: expect.any(String), gatewayRef: expect.any(String) }),
      );
    });
  });

  describe('resolveDispute — SPLIT_50_50', () => {
    it('should split net, credit freelancer + refund client, set RELEASED', async () => {
      const { employer, freelancer, admin, contract, escrow } = await setupFundedEscrow();
      const dispute = await createAndTrackDispute(contract.id, freelancer.id);

      const halfGross = Math.floor(escrow.grossAmount / 2);
      const freelancerWalletBefore = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });
      const employerWalletBefore = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });

      await disputesService.resolveDispute(dispute.id, '50/50 split', 'SPLIT_50_50', admin.id);

      const freelancerWalletAfter = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });
      expect(freelancerWalletAfter!.pendingBalance).toBe(
        freelancerWalletBefore!.pendingBalance + halfGross,
      );

      const employerWalletAfter = await prisma.employerWallet.findUnique({
        where: { userId: employer.id },
      });
      const expectedRefund = escrow.grossAmount - halfGross;
      expect(employerWalletAfter!.balance).toBe(employerWalletBefore!.balance + expectedRefund);

      const escrowAfter = await prisma.escrowTransaction.findUnique({ where: { id: escrow.id } });
      expect(escrowAfter!.status).toBe('RELEASED');
    });
  });

  describe('resolveDispute — PARTIAL_RELEASE', () => {
    it('should release partialPercentage to freelancer, refund rest to client', async () => {
      const { _employer, freelancer, admin, contract, escrow } = await setupFundedEscrow();
      const dispute = await createAndTrackDispute(contract.id, freelancer.id);

      const partialPct = 30;
      const expectedFreelancer = Math.round(escrow.netAmount * (partialPct / 100));
      const freelancerWalletBefore = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });

      await disputesService.resolveDispute(
        dispute.id,
        '30% to freelancer',
        'PARTIAL_RELEASE',
        admin.id,
        partialPct,
      );

      const freelancerWalletAfter = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });
      expect(freelancerWalletAfter!.pendingBalance).toBe(
        freelancerWalletBefore!.pendingBalance + expectedFreelancer,
      );

      const escrowAfter = await prisma.escrowTransaction.findUnique({ where: { id: escrow.id } });
      expect(escrowAfter!.status).toBe('RELEASED');
    });

    it('should reject invalid partialPercentage', async () => {
      const { freelancer, admin, contract } = await setupFundedEscrow();
      const dispute = await createAndTrackDispute(contract.id, freelancer.id);

      await expect(
        disputesService.resolveDispute(dispute.id, 'Partial', 'PARTIAL_RELEASE', admin.id, 0),
      ).rejects.toThrow('partialPercentage');
    });
  });

  describe('resolveDispute — validation', () => {
    it('should reject if dispute not found', async () => {
      const { admin } = await setupFundedEscrow();
      await expect(
        disputesService.resolveDispute(
          crypto.randomUUID(),
          'test',
          'RELEASE_TO_FREELANCER',
          admin.id,
        ),
      ).rejects.toThrow('not found');
    });

    it('should reject if already resolved', async () => {
      const { _employer, freelancer, admin, contract } = await setupFundedEscrow();
      const dispute = await createAndTrackDispute(contract.id, freelancer.id);

      await disputesService.resolveDispute(
        dispute.id,
        'First resolution',
        'RELEASE_TO_FREELANCER',
        admin.id,
      );

      await expect(
        disputesService.resolveDispute(
          dispute.id,
          'Second resolution',
          'REFUND_TO_CLIENT',
          admin.id,
        ),
      ).rejects.toThrow('already resolved');
    });

    it('should reject if escrow is not DISPUTED', async () => {
      const { _employer, freelancer, admin, contract, escrow } = await setupFundedEscrow();
      const dispute = await createAndTrackDispute(contract.id, freelancer.id);
      await prisma.escrowTransaction.update({
        where: { id: escrow.id },
        data: { status: 'FUNDED' },
      });

      await expect(
        disputesService.resolveDispute(dispute.id, 'Bad state', 'RELEASE_TO_FREELANCER', admin.id),
      ).rejects.toThrow('must be DISPUTED');
    });

    it('should notify both parties on resolution', async () => {
      const { employer, freelancer, admin, contract } = await setupFundedEscrow();
      const dispute = await createAndTrackDispute(contract.id, freelancer.id);

      mockNotificationsQueue.add.mockClear();

      await disputesService.resolveDispute(
        dispute.id,
        'Notified all',
        'RELEASE_TO_FREELANCER',
        admin.id,
      );

      const notificationCalls = mockNotificationsQueue.add.mock.calls.filter(
        (c: any[]) => c[0] === NOTIFICATION_JOBS.SEND_IN_APP,
      );
      const notifiedUserIds = notificationCalls.map((c: any[]) => c[1].userId);
      expect(notifiedUserIds).toContain(employer.id);
      expect(notifiedUserIds).toContain(freelancer.id);
    });
  });

  describe('transactional invariants', () => {
    it('should create event log entries for dispute lifecycle', async () => {
      const { _employer, freelancer, admin, contract } = await setupFundedEscrow();
      const dispute = await createAndTrackDispute(contract.id, freelancer.id);

      const raisedEvent = await prisma.eventLog.findFirst({
        where: { entityId: dispute.id, eventType: 'dispute.raised' },
      });
      expect(raisedEvent).toBeDefined();

      await disputesService.resolveDispute(
        dispute.id,
        'Audit trail check',
        'RELEASE_TO_FREELANCER',
        admin.id,
      );

      const resolvedEvent = await prisma.eventLog.findFirst({
        where: { entityId: dispute.id, eventType: 'dispute.resolved' },
      });
      expect(resolvedEvent).toBeDefined();
      expect(resolvedEvent!.payload).toMatchObject({ resolutionType: 'RELEASE_TO_FREELANCER' });
    });

    it('should not credit freelancer when REFUND_TO_CLIENT', async () => {
      const { _employer, freelancer, admin, contract } = await setupFundedEscrow();
      const dispute = await createAndTrackDispute(contract.id, freelancer.id);

      const walletBefore = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });

      await disputesService.resolveDispute(dispute.id, 'Refund all', 'REFUND_TO_CLIENT', admin.id);

      const walletAfter = await prisma.freelancerWallet.findUnique({
        where: { userId: freelancer.id },
      });
      expect(walletAfter!.pendingBalance).toBe(walletBefore!.pendingBalance);
    });
  });
});
