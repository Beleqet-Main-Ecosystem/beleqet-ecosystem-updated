import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { NotFoundException } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

const mockPrisma: Record<string, any> = {
  freelanceJob: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  employerWallet: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  employerWalletTransaction: { create: jest.fn() },
  escrowTransaction: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  milestone: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  eventLog: { create: jest.fn() },
  freelancerWallet: { upsert: jest.fn() },
  $transaction: jest.fn(),
};

mockPrisma.$transaction = jest.fn(async (cb: any) => {
  if (typeof cb === 'function') return cb(mockPrisma);
  return Promise.all(cb);
});

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'FRONTEND_URL') return 'http://localhost:3000';
    if (key === 'CHAPA_SECRET_KEY') return 'test-chapa-key';
    if (key === 'NODE_ENV') return 'test';
    return fallback;
  }),
};

const mockWalletSvc = {
  convertCurrency: jest.fn().mockImplementation((amount: number, from: string, to: string) => {
    if (from === to) return amount;
    return amount * 1.5;
  }),
};

const mockEscrowQueue = { add: jest.fn().mockResolvedValue({}) };

describe('EscrowService', () => {
  let svc: EscrowService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: WalletService, useValue: mockWalletSvc },
        { provide: getQueueToken('escrow'), useValue: mockEscrowQueue },
      ],
    }).compile();
    svc = module.get<EscrowService>(EscrowService);
  });

  describe('initiate', () => {
    it('should throw NotFoundException if gig not found', async () => {
      mockPrisma.freelanceJob.findFirst.mockResolvedValue(null);
      await expect(svc.initiate('client-1', 'g1')).rejects.toThrow(NotFoundException);
    });

    it('should initiate escrow with wallet when fully funded', async () => {
      mockPrisma.freelanceJob.findFirst.mockResolvedValue({
        id: 'g1', budgetMax: 5000, client: { email: 'c@t.com', firstName: 'John', lastName: 'Doe' },
        contract: { agreedAmount: 5000 },
      });
      mockPrisma.employerWallet.findUnique.mockResolvedValue({ id: 'w1', balance: 5000 });
      mockPrisma.escrowTransaction.upsert.mockResolvedValue({ id: 'e1', grossAmount: 5000, platformFee: 500, netAmount: 4500 });

      const result = await svc.initiate('client-1', 'g1');
      expect(result.checkoutUrl).toBeNull();
      expect(result.walletAppliedAmount).toBe(5000);
    });

    it('should initiate escrow with partial wallet funding', async () => {
      mockPrisma.freelanceJob.findFirst.mockResolvedValue({
        id: 'g1', budgetMax: 5000, client: { email: 'c@t.com', firstName: 'John', lastName: 'Doe' },
        contract: { agreedAmount: 5000 },
      });
      mockPrisma.employerWallet.findUnique.mockResolvedValue({ id: 'w1', balance: 2000 });
      mockPrisma.escrowTransaction.upsert.mockResolvedValue({ id: 'e1', grossAmount: 5000 });

      const result = await svc.initiate('client-1', 'g1');
      expect(result.walletAppliedAmount).toBe(2000);
      expect(result.amountToPay).toBe(3000);
    });

    it('should initiate escrow without wallet when no balance', async () => {
      mockPrisma.freelanceJob.findFirst.mockResolvedValue({
        id: 'g1', budgetMax: 5000, client: { email: 'c@t.com', firstName: 'John', lastName: 'Doe' },
        contract: { agreedAmount: 5000 },
      });
      mockPrisma.employerWallet.findUnique.mockResolvedValue(null);
      mockPrisma.escrowTransaction.upsert.mockResolvedValue({ id: 'e1', grossAmount: 5000 });

      const result = await svc.initiate('client-1', 'g1');
      expect(result.amountToPay).toBe(5000);
    });
  });

  describe('handleWebhook', () => {
    it('should enqueue webhook job', async () => {
      await svc.handleWebhook({ reference: 'ref-1', status: 'success' });
      expect(mockEscrowQueue.add).toHaveBeenCalledWith(
        'process-payment-webhook',
        { reference: 'ref-1', status: 'success' },
      );
    });
  });

  describe('releaseMilestone', () => {
    it('should throw NotFoundException if milestone not found', async () => {
      mockPrisma.milestone.findFirst.mockResolvedValue(null);
      await expect(svc.releaseMilestone('m1', 'client-1')).rejects.toThrow(NotFoundException);
    });

    it('should approve milestone and queue auto-release', async () => {
      mockPrisma.milestone.findFirst.mockResolvedValue({
        id: 'm1', amount: 1000,
        contract: { freelancerId: 'f1', currency: 'ETB', clientId: 'client-1', freelanceJob: { escrowTx: {} } },
      });
      mockPrisma.milestone.update.mockResolvedValue({});

      const result = await svc.releaseMilestone('m1', 'client-1');
      expect(result.success).toBe(true);
      expect(mockEscrowQueue.add).toHaveBeenCalled();
    });
  });
});
