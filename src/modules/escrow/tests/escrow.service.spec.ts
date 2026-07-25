import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';

import { EscrowService } from '../escrow.service';
import { PrismaService } from '@prisma-client';
import { WalletService } from '@modules/wallet/wallet.service';
import { QUEUE_NAMES, ESCROW_JOBS, NOTIFICATION_JOBS } from '@modules/queues/queues.constants';

describe('EscrowService', () => {
  let service: EscrowService;
  let prisma: any;
  let escrowQueue: any;
  let notificationsQueue: any;
  const mockI18nService = {
    t: jest.fn((key: string, options?: { defaultValue?: string }) => options?.defaultValue || key),
  };

  beforeEach(async () => {
    prisma = {
      freelanceJob: { findFirst: jest.fn(), update: jest.fn() },
      employerWallet: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() },
      escrowTransaction: {
        create: jest.fn(),
        upsert: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      employerWalletTransaction: { create: jest.fn() },
      milestone: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      contract: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      eventLog: { create: jest.fn() },
      freelancerWallet: { upsert: jest.fn() },
      walletTransaction: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prisma)),
      $queryRaw: jest.fn(),
    };

    escrowQueue = { add: jest.fn().mockResolvedValue({}) };
    notificationsQueue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: prisma },
        { provide: WalletService, useValue: { convertCurrency: jest.fn((amount) => amount) } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              const configMap: Record<string, any> = {
                CHAPA_SECRET_KEY: 'test-secret',
                CHAPA_CALLBACK_URL: 'http://localhost/callback',
                CHAPA_RETURN_URL: 'http://localhost/return',
                FRONTEND_URL: 'http://localhost',
                PLATFORM_FEE_PCT: 0.1,
                AUTO_RELEASE_HOURS: 72,
              };
              return configMap[key] ?? def;
            }),
          },
        },
        { provide: I18nService, useValue: mockI18nService },
        { provide: `BullQueue_${QUEUE_NAMES.ESCROW}`, useValue: escrowQueue },
        { provide: `BullQueue_${QUEUE_NAMES.NOTIFICATIONS}`, useValue: notificationsQueue },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);

    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        status: 'success',
        data: { checkout_url: 'https://checkout.chapa.co/123' },
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiate', () => {
    const mockJob = {
      id: 'job1',
      clientId: 'client1',
      budgetMax: 10000,
      contract: { agreedAmount: 10000, currency: 'ETB' },
      client: { email: 'client@test.com', firstName: 'C', lastName: 'L' },
    };

    it('should throw NotFoundException if gig not found', async () => {
      prisma.freelanceJob.findFirst.mockResolvedValue(null);
      await expect(service.initiate('client1', 'job1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if no contract exists (no accepted bid)', async () => {
      prisma.freelanceJob.findFirst.mockResolvedValue({
        ...mockJob,
        contract: null,
      });
      await expect(service.initiate('client1', 'job1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on existing terminal escrow', async () => {
      prisma.freelanceJob.findFirst.mockResolvedValue(mockJob);
      prisma.$queryRaw.mockResolvedValue([{ id: 'wallet1', balance: 0 }]);
      prisma.escrowTransaction.findUnique.mockResolvedValue({ status: 'FUNDED' });
      await expect(service.initiate('client1', 'job1')).rejects.toThrow(BadRequestException);
    });

    it('should handle fully wallet-funded escrow', async () => {
      prisma.freelanceJob.findFirst.mockResolvedValue(mockJob);
      prisma.$queryRaw.mockResolvedValue([{ id: 'wallet1', balance: 20000 }]);
      prisma.escrowTransaction.findUnique.mockResolvedValue(null);
      prisma.escrowTransaction.create.mockResolvedValue({
        id: 'escrow1',
        grossAmount: 10000,
        walletAppliedAmount: 10000,
      });
      prisma.employerWallet.findUnique.mockResolvedValue({ id: 'wallet1' });

      const res = await service.initiate('client1', 'job1');
      expect(res.walletAppliedAmount).toBe(10000);
      expect(res.checkoutUrl).toBeNull();
      expect(notificationsQueue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_IN_APP,
        expect.any(Object),
      );
      expect(prisma.freelanceJob.update).toHaveBeenCalledWith({
        where: { id: 'job1' },
        data: { status: 'FUNDED' },
      });
    });

    it('should initiate Chapa payment if wallet balance is insufficient', async () => {
      prisma.freelanceJob.findFirst.mockResolvedValue(mockJob);
      prisma.$queryRaw.mockResolvedValue([{ id: 'wallet1', balance: 5000 }]);
      prisma.escrowTransaction.findUnique.mockResolvedValue(null);
      prisma.escrowTransaction.create.mockResolvedValue({
        id: 'escrow1',
        grossAmount: 10000,
        walletAppliedAmount: 5000,
      });

      const res = await service.initiate('client1', 'job1');
      expect(res.amountToPay).toBe(5000);
      expect(res.checkoutUrl).toBe('https://checkout.chapa.co/123');
      expect(escrowQueue.add).toHaveBeenCalledWith(
        ESCROW_JOBS.UNLOCK_FUNDS,
        expect.any(Object),
        expect.any(Object),
      );
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should throw BadRequestException on Prisma P2002/P2003 (insufficient balance constraint)', async () => {
      prisma.freelanceJob.findFirst.mockResolvedValue(mockJob);
      prisma.$transaction = jest
        .fn()
        .mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Error', { code: 'P2002', clientVersion: '1' }),
        );
      await expect(service.initiate('client1', 'job1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleWebhook', () => {
    it('should queue the webhook payload', async () => {
      await service.handleWebhook({ reference: 'ref1', status: 'success' });
      expect(escrowQueue.add).toHaveBeenCalledWith(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'ref1',
        status: 'success',
      });
    });
  });

  describe('releaseMilestone', () => {
    const mockMilestone = {
      id: 'm1',
      amount: 5000,
      contract: {
        status: 'ACTIVE',
        freelancerId: 'f1',
        freelanceJob: { escrowTx: { status: 'FUNDED' } },
      },
    };

    it('should throw NotFoundException if milestone not found', async () => {
      prisma.milestone.findFirst.mockResolvedValue(null);
      await expect(service.releaseMilestone('m1', 'c1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if contract not ACTIVE', async () => {
      prisma.milestone.findFirst.mockResolvedValue({
        ...mockMilestone,
        contract: { ...mockMilestone.contract, status: 'COMPLETED' },
      });
      await expect(service.releaseMilestone('m1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if escrow not FUNDED', async () => {
      prisma.milestone.findFirst.mockResolvedValue({
        ...mockMilestone,
        contract: { ...mockMilestone.contract, freelanceJob: { escrowTx: { status: 'PENDING' } } },
      });
      await expect(service.releaseMilestone('m1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if milestone not SUBMITTED', async () => {
      prisma.milestone.findFirst.mockResolvedValue(mockMilestone);
      prisma.$queryRaw.mockResolvedValue([{ status: 'PENDING' }]);
      await expect(service.releaseMilestone('m1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('should release milestone and queue auto-release', async () => {
      prisma.milestone.findFirst.mockResolvedValue(mockMilestone);
      prisma.$queryRaw.mockResolvedValue([{ status: 'SUBMITTED' }]);

      await service.releaseMilestone('m1', 'c1');
      expect(prisma.milestone.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'APPROVED', approvedAt: expect.any(Date) },
      });
      expect(prisma.freelancerWallet.upsert).toHaveBeenCalledWith({
        where: { userId: 'f1' },
        update: { pendingBalance: { increment: 5000 } },
        create: { userId: 'f1', pendingBalance: 5000, availableBalance: 0 },
      });
      expect(escrowQueue.add).toHaveBeenCalledWith(
        ESCROW_JOBS.AUTO_RELEASE,
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('requestRevision', () => {
    const mockMilestone = {
      id: 'm1',
      status: 'SUBMITTED',
      contractId: 'contract1',
      contract: { status: 'ACTIVE', freelancerId: 'f1', clientId: 'c1' },
    };

    it('should throw NotFoundException if milestone not found', async () => {
      prisma.milestone.findFirst.mockResolvedValue(null);
      await expect(service.requestRevision('m1', 'c1', 'reason')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if milestone not SUBMITTED', async () => {
      prisma.milestone.findFirst.mockResolvedValue({ ...mockMilestone, status: 'APPROVED' });
      await expect(service.requestRevision('m1', 'c1', 'reason')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if contract not ACTIVE', async () => {
      prisma.milestone.findFirst.mockResolvedValue({
        ...mockMilestone,
        contract: { ...mockMilestone.contract, status: 'COMPLETED' },
      });
      await expect(service.requestRevision('m1', 'c1', 'reason')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update milestone and notify freelancer', async () => {
      prisma.milestone.findFirst.mockResolvedValue(mockMilestone);
      prisma.milestone.update.mockResolvedValue({ revisionCount: 1 });

      await service.requestRevision('m1', 'c1', 'reason');
      expect(prisma.milestone.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: {
          status: 'REVISION_REQUESTED',
          revisionNotes: 'reason',
          revisionCount: { increment: 1 },
        },
      });
      expect(notificationsQueue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_IN_APP,
        expect.objectContaining({ userId: 'f1', type: 'milestone.revision_requested' }),
      );
    });
  });

  describe('cancelEscrow', () => {
    const mockEscrow = {
      id: 'e1',
      status: 'FUNDED',
      grossAmount: 10000,
      walletAppliedAmount: 4000,
      currency: 'ETB',
      gatewayRef: 'ref',
      freelanceJobId: 'job1',
      freelanceJob: { contract: { milestones: [] } },
    };

    it('should throw NotFoundException if escrow not found', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue(null);
      await expect(service.cancelEscrow('e1', 'c1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if escrow in non-cancellable status', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({ ...mockEscrow, status: 'RELEASED' });
      await expect(service.cancelEscrow('e1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if active milestones exist', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({
        ...mockEscrow,
        freelanceJob: { contract: { milestones: [{ status: 'SUBMITTED' }] } },
      });
      await expect(service.cancelEscrow('e1', 'c1')).rejects.toThrow(BadRequestException);
    });

    it('should cancel escrow and queue refund', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue(mockEscrow);
      prisma.employerWallet.findUnique.mockResolvedValue({ id: 'w1' });

      await service.cancelEscrow('e1', 'c1');
      expect(prisma.escrowTransaction.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { status: 'REFUNDED', gatewayResponse: expect.any(Object) },
      });
      expect(prisma.employerWallet.update).toHaveBeenCalledWith({
        where: { id: 'w1' },
        data: { balance: { increment: 4000 } },
      });
      expect(prisma.freelanceJob.update).toHaveBeenCalledWith({
        where: { id: 'job1' },
        data: { status: 'DRAFT' },
      });
      expect(escrowQueue.add).toHaveBeenCalledWith(
        ESCROW_JOBS.CANCEL_CHAPA_PAYMENT,
        expect.any(Object),
      );
      expect(notificationsQueue.add).toHaveBeenCalled();
    });

    it('should unlock funds if escrow was PENDING', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({ ...mockEscrow, status: 'PENDING' });
      prisma.employerWallet.findUnique.mockResolvedValue({ id: 'w1' });

      await service.cancelEscrow('e1', 'c1');
      expect(prisma.employerWallet.update).toHaveBeenCalledWith({
        where: { id: 'w1' },
        data: { balance: { increment: 4000 }, lockedBalance: { decrement: 4000 } },
      });
    });
  });

  describe('Summaries', () => {
    it('getEmployerEscrowSummary should return data', async () => {
      prisma.$queryRaw.mockResolvedValue([{ totalEscrows: 10 }]);
      const res = await service.getEmployerEscrowSummary('c1');
      expect(res.totalEscrows).toBe(10);
      expect(res.activeEscrows).toBe(0);
    });

    it('getFreelancerEscrowSummary should return data', async () => {
      prisma.$queryRaw.mockResolvedValue([{ totalEarned: 5000 }]);
      const res = await service.getFreelancerEscrowSummary('f1');
      expect(res.totalEarned).toBe(5000);
      expect(res.activeEscrows).toBe(0);
    });
  });

  describe('Lists & Gets', () => {
    it('listByClient should return paginated data', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: 'e1' }]).mockResolvedValueOnce([{ count: 1 }]);
      const res = await service.listByClient('c1');
      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
    });

    it('getByIdForClient should return escrow', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({
        id: 'e1',
        freelanceJob: { title: 'T', contract: { milestones: [] } },
      });
      const res = await service.getByIdForClient('e1', 'c1');
      expect(res.id).toBe('e1');
    });

    it('listByFreelancer should return paginated data', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: 'e1' }]).mockResolvedValueOnce([{ count: 1 }]);
      const res = await service.listByFreelancer('f1');
      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
    });

    it('getByIdForFreelancer should return escrow', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({
        id: 'e1',
        freelanceJob: { title: 'T', client: {}, contract: { milestones: [] } },
      });
      const res = await service.getByIdForFreelancer('e1', 'f1');
      expect(res.id).toBe('e1');
    });

    it('adminGetEscrowDetail should return escrow', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({
        id: 'e1',
        freelanceJob: { title: 'T', client: {}, contract: { milestones: [] } },
      });
      const res = await service.adminGetEscrowDetail('e1');
      expect(res.id).toBe('e1');
    });
  });

  describe('Admin Force Actions', () => {
    describe('adminForceRelease', () => {
      const mockEscrow = {
        id: 'e1',
        status: 'FUNDED',
        netAmount: 10000,
        freelanceJobId: 'job1',
        freelanceJob: {
          contract: { freelancerId: 'f1', milestones: [{ status: 'APPROVED', amount: 2000 }] },
        },
      };

      it('should throw NotFoundException if escrow not found', async () => {
        prisma.escrowTransaction.findUnique.mockResolvedValue(null);
        await expect(service.adminForceRelease('e1', 'admin')).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if escrow not FUNDED/DISPUTED', async () => {
        prisma.escrowTransaction.findUnique.mockResolvedValue({ ...mockEscrow, status: 'PENDING' });
        await expect(service.adminForceRelease('e1', 'admin')).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException if no contract', async () => {
        prisma.escrowTransaction.findUnique.mockResolvedValue({
          ...mockEscrow,
          freelanceJob: { contract: null },
        });
        await expect(service.adminForceRelease('e1', 'admin')).rejects.toThrow(BadRequestException);
      });

      it('should release remaining funds and queue auto-release', async () => {
        prisma.escrowTransaction.findUnique.mockResolvedValue(mockEscrow);
        await service.adminForceRelease('e1', 'admin');

        expect(prisma.escrowTransaction.update).toHaveBeenCalledWith({
          where: { id: 'e1' },
          data: { status: 'RELEASED', releasedAt: expect.any(Date) },
        });
        expect(prisma.freelancerWallet.upsert).toHaveBeenCalledWith({
          where: { userId: 'f1' },
          update: { pendingBalance: { increment: 8000 } },
          create: expect.any(Object),
        });
        expect(escrowQueue.add).toHaveBeenCalledWith(
          ESCROW_JOBS.AUTO_RELEASE,
          expect.any(Object),
          expect.any(Object),
        );
      });
    });

    describe('adminForceRefund', () => {
      const mockEscrow = {
        id: 'e1',
        status: 'FUNDED',
        grossAmount: 10000,
        walletAppliedAmount: 4000,
        gatewayRef: 'ref',
        freelanceJobId: 'job1',
        freelanceJob: { clientId: 'c1' },
      };

      it('should refund wallet, update status, and queue chapa cancellation', async () => {
        prisma.escrowTransaction.findUnique.mockResolvedValue(mockEscrow);
        prisma.employerWallet.findUnique.mockResolvedValue({ id: 'w1' });

        await service.adminForceRefund('e1', 'admin');

        expect(prisma.escrowTransaction.update).toHaveBeenCalledWith({
          where: { id: 'e1' },
          data: { status: 'REFUNDED', gatewayResponse: expect.any(Object) },
        });
        expect(prisma.employerWallet.update).toHaveBeenCalledWith({
          where: { id: 'w1' },
          data: { balance: { increment: 4000 } },
        });
        expect(escrowQueue.add).toHaveBeenCalledWith(
          ESCROW_JOBS.CANCEL_CHAPA_PAYMENT,
          expect.any(Object),
        );
        expect(notificationsQueue.add).toHaveBeenCalled();
      });
    });
  });

  describe('completeContract', () => {
    const mockContract = {
      id: 'c1',
      status: 'ACTIVE',
      clientId: 'c1',
      freelancerId: 'f1',
      milestones: [{ status: 'APPROVED' }],
      freelanceJobId: 'job1',
      freelanceJob: { escrowTx: { id: 'e1', status: 'FUNDED' } },
    };

    it('should throw NotFoundException if contract not found', async () => {
      prisma.contract.findFirst.mockResolvedValue(null);
      await expect(service.completeContract('c1', 'user')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if contract not ACTIVE', async () => {
      prisma.contract.findFirst.mockResolvedValue({ ...mockContract, status: 'COMPLETED' });
      await expect(service.completeContract('c1', 'user')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if milestones are SUBMITTED', async () => {
      prisma.contract.findFirst.mockResolvedValue({
        ...mockContract,
        milestones: [{ status: 'SUBMITTED' }],
      });
      await expect(service.completeContract('c1', 'user')).rejects.toThrow(BadRequestException);
    });

    it('should complete contract, update escrow/job, and notify', async () => {
      prisma.contract.findFirst.mockResolvedValue(mockContract);

      await service.completeContract('c1', 'c1');

      expect(prisma.contract.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'COMPLETED', completedAt: expect.any(Date) },
      });
      expect(prisma.escrowTransaction.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { status: 'RELEASED', releasedAt: expect.any(Date) },
      });
      expect(prisma.freelanceJob.update).toHaveBeenCalledWith({
        where: { id: 'job1' },
        data: { status: 'COMPLETED' },
      });
      expect(notificationsQueue.add).toHaveBeenCalledTimes(2);
    });
  });
});
