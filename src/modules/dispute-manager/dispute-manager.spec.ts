import { Test, TestingModule } from '@nestjs/testing';
import { DisputeManagerService } from './dispute-manager.service';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/**
 * Unit tests for the Dispute Manager Service
 */
describe('DisputeManagerService', () => {
  let service: DisputeManagerService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const prismaMock = {
      $transaction: jest.fn(),
      contract: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      dispute: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
      },
      employerWallet: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      employerWalletTransaction: {
        create: jest.fn(),
      },
      escrowTransaction: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(
      (operation: (transaction: typeof prismaMock) => Promise<unknown>) => operation(prismaMock),
    );

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
        freelanceJobId: 'job-id',
        status: 'ACTIVE',
      });
      (prismaService.contract.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.escrowTransaction.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.dispute.create as jest.Mock).mockResolvedValue({ id: 'd-id' });

      const result = await service.createDispute('user-id', {
        contractId: 'c-id',
        reason: 'Poor quality work',
        evidenceUrls: ['https://evidence.example/file.pdf'],
      });

      expect(prismaService.contract.updateMany).toHaveBeenCalledWith({
        where: { id: 'c-id', status: 'ACTIVE' },
        data: { status: 'DISPUTED' },
      });
      expect(result).toEqual({ id: 'd-id' });
    });
  });

  describe('resolveDispute', () => {
    const openDispute = {
      id: 'd-id',
      contractId: 'c-id',
      resolution: null,
      resolvedAt: null,
      contract: {
        id: 'c-id',
        clientId: 'client-id',
        freelanceJobId: 'job-id',
        status: 'DISPUTED',
        agreedAmount: 50_000,
        currency: 'ETB',
      },
    };

    it('atomically records an admin decision and same-currency refund', async () => {
      (prismaService.dispute.findUnique as jest.Mock).mockResolvedValue(openDispute);
      (prismaService.dispute.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.contract.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.employerWallet.findUnique as jest.Mock).mockResolvedValue({
        id: 'wallet-id',
        currency: 'ETB',
      });
      (prismaService.escrowTransaction.findUnique as jest.Mock).mockResolvedValue({
        id: 'escrow-id',
        status: 'DISPUTED',
        currency: 'ETB',
        grossAmount: 50_000,
      });
      (prismaService.escrowTransaction.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prismaService.dispute.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        id: 'd-id',
        resolution: 'Refund approved',
      });

      const result = await service.resolveDispute('d-id', 'admin-id', {
        resolution: 'Refund approved in full',
        refundAmount: 10_000,
        refundCurrency: 'ETB',
        lang: 'en',
      });

      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaService.employerWallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet-id' },
        data: { balance: { increment: 10_000 } },
      });
      expect(prismaService.contract.updateMany).toHaveBeenCalledWith({
        where: { id: 'c-id', status: 'DISPUTED' },
        data: { status: 'CANCELLED' },
      });
      expect(prismaService.escrowTransaction.updateMany).toHaveBeenCalledWith({
        where: { id: 'escrow-id', status: 'DISPUTED' },
        data: { status: 'REFUNDED' },
      });
      expect(result.dispute).toEqual({ id: 'd-id', resolution: 'Refund approved' });
    });

    it('rejects a refund in a currency different from the contract', async () => {
      (prismaService.dispute.findUnique as jest.Mock).mockResolvedValue(openDispute);

      await expect(
        service.resolveDispute('d-id', 'admin-id', {
          resolution: 'Refund approved in full',
          refundAmount: 10_000,
          refundCurrency: 'USD',
          lang: 'en',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a concurrent or repeated resolution', async () => {
      (prismaService.dispute.findUnique as jest.Mock).mockResolvedValue({
        ...openDispute,
        resolution: 'Already handled',
        resolvedAt: new Date(),
      });

      await expect(
        service.resolveDispute('d-id', 'admin-id', {
          resolution: 'Try resolving again',
          lang: 'en',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
