import { Test, TestingModule } from '@nestjs/testing';
import { DisputeManagerService } from './dispute-manager.service';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { NotFoundException, BadRequestException } from '@nestjs/common';

/**
 * Unit tests for the Dispute Manager Service
 */
describe('DisputeManagerService', () => {
  let service: DisputeManagerService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const prismaMock = {
      contract: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      dispute: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const i18nMock = {
      t: jest.fn().mockReturnValue('Dispute resolved successfully'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeManagerService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    service = module.get<DisputeManagerService>(DisputeManagerService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDispute', () => {
    it('should throw NotFoundException if contract not found', async () => {
      (prismaService.contract.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createDispute('user-id', { contractId: 'c-id', reason: 'r', evidenceUrls: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is not authorized', async () => {
      (prismaService.contract.findUnique as jest.Mock).mockResolvedValue({
        id: 'c-id',
        clientId: 'client-id',
        freelancerId: 'freelancer-id',
      });

      await expect(
        service.createDispute('unauthorized-user', {
          contractId: 'c-id',
          reason: 'r',
          evidenceUrls: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create dispute successfully', async () => {
      (prismaService.contract.findUnique as jest.Mock).mockResolvedValue({
        id: 'c-id',
        clientId: 'user-id',
        freelancerId: 'freelancer-id',
      });
      (prismaService.dispute.create as jest.Mock).mockResolvedValue({ id: 'd-id' });

      const result = await service.createDispute('user-id', {
        contractId: 'c-id',
        reason: 'Poor quality',
        evidenceUrls: ['http://evidence.com'],
      });

      expect(prismaService.contract.update).toHaveBeenCalledWith({
        where: { id: 'c-id' },
        data: { status: 'DISPUTED' },
      });
      expect(result).toEqual({ id: 'd-id' });
    });
  });
});

describe('DisputeManagerService.resolveDispute', () => {
  const tx = {
    dispute: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'd1' }) },
    employerWallet: { upsert: jest.fn().mockResolvedValue({ id: 'ew1' }) },
    employerWalletTransaction: { create: jest.fn() },
    freelancerWallet: { upsert: jest.fn().mockResolvedValue({ id: 'fw1' }) },
    walletTransaction: { create: jest.fn() },
    escrowTransaction: { update: jest.fn() },
    contract: { update: jest.fn() },
    eventLog: { create: jest.fn() },
  };
  const prisma = {
    dispute: { findUnique: jest.fn() },
    milestone: { aggregate: jest.fn() },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  let service: DisputeManagerService;

  // 10,000 funded, 3,000 already released for an approved milestone: 7,000 still held.
  const dispute = (escrowStatus = 'DISPUTED') => ({
    id: 'd1',
    resolvedAt: null,
    contract: {
      id: 'c1',
      clientId: 'client',
      freelancerId: 'free',
      freelanceJob: { escrowTx: { id: 'e1', status: escrowStatus, grossAmount: 10000 } },
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    tx.dispute.updateMany.mockResolvedValue({ count: 1 });
    prisma.milestone.aggregate.mockResolvedValue({ _sum: { amount: 3000 } });
    const module = await Test.createTestingModule({
      providers: [
        DisputeManagerService,
        { provide: PrismaService, useValue: prisma },
        { provide: I18nService, useValue: { t: jest.fn().mockReturnValue('ok') } },
      ],
    }).compile();
    service = module.get(DisputeManagerService);
  });

  const resolution = 'Work was not delivered as agreed.';

  it('refunds everything still held to the client and cancels the contract', async () => {
    prisma.dispute.findUnique.mockResolvedValue(dispute());
    await service.resolveDispute('d1', { resolution, outcome: 'REFUND' }, 'admin');
    expect(tx.employerWallet.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { balance: { increment: 7000 } } }));
    expect(tx.freelancerWallet.upsert).not.toHaveBeenCalled();
    expect(tx.escrowTransaction.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { status: 'REFUNDED' } });
    expect(tx.contract.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: 'CANCELLED' } });
  });

  it('releases what is held to the freelancer, less the platform fee', async () => {
    prisma.dispute.findUnique.mockResolvedValue(dispute());
    await service.resolveDispute('d1', { resolution, outcome: 'RELEASE' }, 'admin');
    expect(tx.freelancerWallet.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { availableBalance: { increment: 6300 } } }));
    expect(tx.employerWallet.upsert).not.toHaveBeenCalled();
    expect(tx.contract.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: 'COMPLETED' } });
  });

  it('splits the held amount', async () => {
    prisma.dispute.findUnique.mockResolvedValue(dispute());
    await service.resolveDispute('d1', { resolution, outcome: 'SPLIT', freelancerAmount: 4000 }, 'admin');
    expect(tx.freelancerWallet.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { availableBalance: { increment: 3600 } } }));
    expect(tx.employerWallet.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { balance: { increment: 3000 } } }));
    expect(tx.dispute.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientAmount: 3000, freelancerAmount: 4000, resolvedById: 'admin' }) }),
    );
  });

  it('refuses a share larger than what is held', async () => {
    prisma.dispute.findUnique.mockResolvedValue(dispute());
    await expect(service.resolveDispute('d1', { resolution, outcome: 'SPLIT', freelancerAmount: 8000 })).rejects.toThrow('7000');
  });

  it('moves no money when escrow was never funded', async () => {
    prisma.dispute.findUnique.mockResolvedValue(dispute('PENDING'));
    await service.resolveDispute('d1', { resolution, outcome: 'RELEASE' }, 'admin');
    expect(tx.freelancerWallet.upsert).not.toHaveBeenCalled();
    expect(tx.employerWallet.upsert).not.toHaveBeenCalled();
    expect(tx.escrowTransaction.update).not.toHaveBeenCalled();
  });

  it('moves money only once if two admins resolve at the same moment', async () => {
    prisma.dispute.findUnique.mockResolvedValue(dispute());
    tx.dispute.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.resolveDispute('d1', { resolution, outcome: 'RELEASE' })).rejects.toThrow('already resolved');
    expect(tx.freelancerWallet.upsert).not.toHaveBeenCalled();
  });
});
