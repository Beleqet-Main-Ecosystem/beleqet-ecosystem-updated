import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { EscrowProcessor } from './escrow.processor';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma: Record<string, any> = {
  escrowTransaction: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  freelanceJob: { update: jest.fn() },
  employerWallet: { findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  employerWalletTransaction: { create: jest.fn() },
  eventLog: { create: jest.fn() },
  freelancerWallet: { upsert: jest.fn() },
  walletTransaction: { create: jest.fn() },
  user: { findUnique: jest.fn() },
  notification: { create: jest.fn() },
  $transaction: jest.fn(),
};

mockPrisma.$transaction = jest.fn(async (cb: any) => {
  if (typeof cb === 'function') return cb(mockPrisma);
  return Promise.all(cb);
});

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'FRONTEND_URL') return 'http://localhost:3000';
    if (key === 'CHAPA_SECRET_KEY') return 'test-key';
    return fallback;
  }),
};

const mockNotificationsQueue = { add: jest.fn().mockResolvedValue({}) };

describe('EscrowProcessor', () => {
  let processor: EscrowProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: getQueueToken('notifications'), useValue: mockNotificationsQueue },
      ],
    }).compile();
    processor = module.get<EscrowProcessor>(EscrowProcessor);
  });

  describe('handleWebhook', () => {
    it('should log warning if escrow not found', async () => {
      mockPrisma.escrowTransaction.findFirst.mockResolvedValue(null);
      const job = { data: { reference: 'ref-1', status: 'success' } } as any;
      await processor.handleWebhook(job);
      expect(mockPrisma.escrowTransaction.findFirst).toHaveBeenCalled();
    });

    it('should skip if already funded (idempotency)', async () => {
      mockPrisma.escrowTransaction.findFirst.mockResolvedValue({
        id: 'e1', status: 'FUNDED',
        freelanceJob: { clientId: 'c1' },
      });
      const job = { data: { reference: 'ref-1', status: 'success' } } as any;
      await processor.handleWebhook(job);
      expect(mockPrisma.escrowTransaction.update).not.toHaveBeenCalled();
    });

    it('should fund escrow on success', async () => {
      mockPrisma.escrowTransaction.findFirst.mockResolvedValue({
        id: 'e1', status: 'PENDING', grossAmount: 5000, walletAppliedAmount: 0,
        freelanceJobId: 'g1', freelanceJob: { clientId: 'c1' },
      });
      mockPrisma.escrowTransaction.update.mockResolvedValue({});
      mockPrisma.freelanceJob.update.mockResolvedValue({});
      mockPrisma.eventLog.create.mockResolvedValue({});

      const job = { data: { reference: 'ref-1', status: 'success' } } as any;
      await processor.handleWebhook(job);
      expect(mockNotificationsQueue.add).toHaveBeenCalled();
    });
  });

  describe('handleAutoRelease', () => {
    it('should move funds from pending to available', async () => {
      mockPrisma.freelancerWallet.upsert.mockResolvedValue({ id: 'w1' });
      mockPrisma.walletTransaction.create.mockResolvedValue({});
      mockPrisma.eventLog.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const pastDate = new Date(Date.now() - 1000).toISOString();
      const job = { data: { milestoneId: 'm1', freelancerId: 'f1', amount: 1000, releaseAt: pastDate } } as any;
      await processor.handleAutoRelease(job);
      expect(mockPrisma.freelancerWallet.upsert).toHaveBeenCalled();
      expect(mockPrisma.walletTransaction.create).toHaveBeenCalled();
    });
  });

  describe('handleWithdrawal', () => {
    it('should process withdrawal and notify', async () => {
      const job = { id: 'j1', data: { userId: 'u1', amount: 1000, method: 'CBE_BIRR', accountRef: '12345' } } as any;
      await processor.handleWithdrawal(job);
      expect(mockNotificationsQueue.add).toHaveBeenCalled();
    });
  });
});
