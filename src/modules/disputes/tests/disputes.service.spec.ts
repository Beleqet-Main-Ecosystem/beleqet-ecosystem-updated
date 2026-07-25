import { Test, TestingModule } from '@nestjs/testing';
import { DisputesService } from '../disputes.service';
import { PrismaService } from '@prisma-client';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('DisputesService', () => {
  const mockNotificationsQueue = { add: jest.fn().mockResolvedValue({}) };
  const mockEscrowQueue = { add: jest.fn().mockResolvedValue({}) };
  const mockI18nService = {
    t: jest.fn((key: string, options?: { defaultValue?: string }) => options?.defaultValue || key),
  };

  function buildMockPrisma(overrides: Record<string, any> = {}) {
    return {
      contract: { findFirst: jest.fn(), update: jest.fn(), ...overrides.contract },
      dispute: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        ...overrides.dispute,
      },
      eventLog: { create: jest.fn(), ...overrides.eventLog },
      $transaction: overrides.$transaction ?? jest.fn(),
    } as any;
  }

  async function createService(prismaOverrides: Record<string, any> = {}) {
    const prisma = buildMockPrisma(prismaOverrides);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: I18nService, useValue: mockI18nService },
        { provide: 'BullQueue_notifications', useValue: mockNotificationsQueue },
        { provide: 'BullQueue_escrow', useValue: mockEscrowQueue },
      ],
    }).compile();

    return { service: module.get<DisputesService>(DisputesService), prisma };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createDispute', () => {
    const baseContract = {
      id: 'c1',
      status: 'ACTIVE',
      clientId: 'client-1',
      freelancerId: 'freelancer-1',
      client: { id: 'client-1', firstName: 'Alice' },
      freelancer: { id: 'freelancer-1', firstName: 'Bob' },
      freelanceJob: { escrowTx: { id: 'escrow-1' } },
    };

    it('should throw NotFoundException when contract not found', async () => {
      const { service } = await createService({
        contract: { findFirst: jest.fn().mockResolvedValue(null) },
      });

      await expect(
        service.createDispute('user-1', { contractId: 'invalid', reason: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when dispute already exists', async () => {
      const { service } = await createService({
        contract: { findFirst: jest.fn().mockResolvedValue(baseContract) },
        dispute: { findUnique: jest.fn().mockResolvedValue({ id: 'd1' }) },
      });

      await expect(
        service.createDispute('client-1', {
          contractId: 'c1',
          reason: 'Test reason with enough chars to pass validation here',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when contract status is not ACTIVE or DISPUTED', async () => {
      const { service } = await createService({
        contract: {
          findFirst: jest.fn().mockResolvedValue({ ...baseContract, status: 'COMPLETED' }),
        },
        dispute: { findUnique: jest.fn().mockResolvedValue(null) },
      });

      await expect(
        service.createDispute('client-1', {
          contractId: 'c1',
          reason: 'Test reason with enough chars to pass validation here',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create dispute successfully when client raises it', async () => {
      const createdDispute = {
        id: 'd1',
        contractId: 'c1',
        raisedById: 'client-1',
        reason: 'Work quality issue',
        evidenceUrls: [],
      };

      const { service, prisma } = await createService({
        contract: { findFirst: jest.fn().mockResolvedValue(baseContract) },
        dispute: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(createdDispute),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            dispute: { create: jest.fn().mockResolvedValue(createdDispute) },
            contract: { update: jest.fn().mockResolvedValue({}) },
            eventLog: { create: jest.fn().mockResolvedValue({}) },
            escrowTransaction: { update: jest.fn().mockResolvedValue({}) },
          }),
        ),
      });

      const result = await service.createDispute('client-1', {
        contractId: 'c1',
        reason: 'Work quality does not match the requirements agreed upon',
        evidenceUrls: ['https://example.com/evidence.png'],
      });

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockNotificationsQueue.add).toHaveBeenCalledTimes(2);
      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        'send-in-app',
        expect.objectContaining({ userId: 'freelancer-1', type: 'dispute.raised' }),
      );
      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        'send-in-app',
        expect.objectContaining({ userId: 'client-1', type: 'dispute.raised' }),
      );
    });

    it('should create dispute successfully when freelancer raises it', async () => {
      const createdDispute = {
        id: 'd2',
        contractId: 'c1',
        raisedById: 'freelancer-1',
        reason: 'Payment not released',
        evidenceUrls: [],
      };

      const { service } = await createService({
        contract: { findFirst: jest.fn().mockResolvedValue(baseContract) },
        dispute: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(createdDispute),
        },
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            dispute: { create: jest.fn().mockResolvedValue(createdDispute) },
            contract: { update: jest.fn().mockResolvedValue({}) },
            eventLog: { create: jest.fn().mockResolvedValue({}) },
            escrowTransaction: { update: jest.fn().mockResolvedValue({}) },
          }),
        ),
      });

      const result = await service.createDispute('freelancer-1', {
        contractId: 'c1',
        reason: 'Payment was not released after milestone completion and approval',
      });

      expect(result.success).toBe(true);
      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        'send-in-app',
        expect.objectContaining({ userId: 'client-1', type: 'dispute.raised' }),
      );
    });
  });

  describe('getDisputeByContract', () => {
    it('should throw NotFoundException when contract not found', async () => {
      const { service } = await createService({
        contract: { findFirst: jest.fn().mockResolvedValue(null) },
      });

      await expect(service.getDisputeByContract('invalid', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when no dispute exists for contract', async () => {
      const { service } = await createService({
        contract: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', status: 'ACTIVE' }) },
        dispute: { findUnique: jest.fn().mockResolvedValue(null) },
      });

      await expect(service.getDisputeByContract('c1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should return dispute when found', async () => {
      const mockDispute = {
        id: 'd1',
        contractId: 'c1',
        reason: 'Test',
        evidenceUrls: [],
        raisedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        contract: { id: 'c1', clientId: 'client-1', freelancerId: 'freelancer-1' },
      };

      const { service } = await createService({
        contract: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', status: 'DISPUTED' }) },
        dispute: { findUnique: jest.fn().mockResolvedValue(mockDispute) },
      });

      const result = await service.getDisputeByContract('c1', 'client-1');
      expect(result).toEqual(mockDispute);
    });
  });

  describe('getMyDisputes', () => {
    it('should return disputes for user', async () => {
      const mockDisputes = [
        {
          id: 'd1',
          contractId: 'c1',
          reason: 'Issue 1',
          contract: { id: 'c1', status: 'ACTIVE' },
          raisedBy: { id: 'u1', firstName: 'A', lastName: 'B' },
        },
      ];

      const { service } = await createService({
        dispute: { findMany: jest.fn().mockResolvedValue(mockDisputes) },
      });

      const result = await service.getMyDisputes('u1');
      expect(result).toEqual(mockDisputes);
    });

    it('should return empty array when no disputes', async () => {
      const { service } = await createService({
        dispute: { findMany: jest.fn().mockResolvedValue([]) },
      });

      const result = await service.getMyDisputes('u1');
      expect(result).toEqual([]);
    });
  });

  describe('resolveDispute', () => {
    const baseDispute = {
      id: 'd1',
      contractId: 'c1',
      raisedById: 'client-1',
      reason: 'Work quality issue',
      evidenceUrls: [],
      resolvedAt: null,
      contract: {
        id: 'c1',
        clientId: 'client-1',
        freelancerId: 'freelancer-1',
        client: { id: 'client-1', firstName: 'Alice' },
        freelancer: { id: 'freelancer-1', firstName: 'Bob' },
        freelanceJob: {
          escrowTx: {
            id: 'escrow-1',
            status: 'DISPUTED',
            netAmount: 10000,
            walletAppliedAmount: 8000,
          },
        },
      },
    };

    it('should throw NotFoundException when dispute not found', async () => {
      const { service } = await createService({
        dispute: { findUnique: jest.fn().mockResolvedValue(null) },
      });

      await expect(
        service.resolveDispute(
          'invalid',
          'Resolution text here',
          'RELEASE_TO_FREELANCER',
          'admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when dispute already resolved', async () => {
      const { service } = await createService({
        dispute: {
          findUnique: jest.fn().mockResolvedValue({ ...baseDispute, resolvedAt: new Date() }),
        },
      });

      await expect(
        service.resolveDispute('d1', 'Resolution text here', 'RELEASE_TO_FREELANCER', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when escrow is not DISPUTED', async () => {
      const { service } = await createService({
        dispute: {
          findUnique: jest.fn().mockResolvedValue({
            ...baseDispute,
            contract: {
              ...baseDispute.contract,
              freelanceJob: {
                escrowTx: { ...baseDispute.contract.freelanceJob.escrowTx, status: 'RELEASED' },
              },
            },
          }),
        },
      });

      await expect(
        service.resolveDispute('d1', 'Resolution text here', 'RELEASE_TO_FREELANCER', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for PARTIAL_RELEASE with invalid percentage', async () => {
      const { service } = await createService({
        dispute: { findUnique: jest.fn().mockResolvedValue(baseDispute) },
      });

      await expect(
        service.resolveDispute('d1', 'Resolution text here', 'PARTIAL_RELEASE', 'admin-1', 0),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.resolveDispute('d1', 'Resolution text here', 'PARTIAL_RELEASE', 'admin-1', 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resolve dispute with RELEASE_TO_FREELANCER', async () => {
      const { service, prisma } = await createService({
        dispute: { findUnique: jest.fn().mockResolvedValue(baseDispute) },
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            dispute: { update: jest.fn().mockResolvedValue({}) },
            escrowTransaction: { update: jest.fn().mockResolvedValue({}) },
            freelancerWallet: {
              upsert: jest.fn().mockResolvedValue({}),
              findUnique: jest.fn().mockResolvedValue({ id: 'fw1' }),
            },
            walletTransaction: { create: jest.fn().mockResolvedValue({}) },
            contract: { update: jest.fn().mockResolvedValue({}) },
            eventLog: { create: jest.fn().mockResolvedValue({}) },
          }),
        ),
      });

      const result = await service.resolveDispute(
        'd1',
        'After reviewing the evidence, the freelancer is entitled to full payment',
        'RELEASE_TO_FREELANCER',
        'admin-1',
      );

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockNotificationsQueue.add).toHaveBeenCalledTimes(2);
    });

    it('should resolve dispute with REFUND_TO_CLIENT', async () => {
      const { service, prisma } = await createService({
        dispute: { findUnique: jest.fn().mockResolvedValue(baseDispute) },
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            dispute: { update: jest.fn().mockResolvedValue({}) },
            escrowTransaction: { update: jest.fn().mockResolvedValue({}) },
            employerWallet: {
              findUnique: jest.fn().mockResolvedValue({ id: 'ew1' }),
              update: jest.fn().mockResolvedValue({}),
            },
            employerWalletTransaction: { create: jest.fn().mockResolvedValue({}) },
            contract: { update: jest.fn().mockResolvedValue({}) },
            eventLog: { create: jest.fn().mockResolvedValue({}) },
          }),
        ),
      });

      const result = await service.resolveDispute(
        'd1',
        'After reviewing the evidence, the work was not delivered as agreed',
        'REFUND_TO_CLIENT',
        'admin-1',
      );

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should resolve dispute with SPLIT_50_50', async () => {
      const { service, prisma } = await createService({
        dispute: { findUnique: jest.fn().mockResolvedValue(baseDispute) },
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            dispute: { update: jest.fn().mockResolvedValue({}) },
            escrowTransaction: { update: jest.fn().mockResolvedValue({}) },
            freelancerWallet: {
              upsert: jest.fn().mockResolvedValue({}),
              findUnique: jest.fn().mockResolvedValue({ id: 'fw1' }),
            },
            walletTransaction: { create: jest.fn().mockResolvedValue({}) },
            employerWallet: {
              findUnique: jest.fn().mockResolvedValue({ id: 'ew1' }),
              update: jest.fn().mockResolvedValue({}),
            },
            employerWalletTransaction: { create: jest.fn().mockResolvedValue({}) },
            contract: { update: jest.fn().mockResolvedValue({}) },
            eventLog: { create: jest.fn().mockResolvedValue({}) },
          }),
        ),
      });

      const result = await service.resolveDispute(
        'd1',
        'Both parties share responsibility, splitting the funds equally',
        'SPLIT_50_50',
        'admin-1',
      );

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should resolve dispute with PARTIAL_RELEASE', async () => {
      const { service, prisma } = await createService({
        dispute: { findUnique: jest.fn().mockResolvedValue(baseDispute) },
        $transaction: jest.fn().mockImplementation(async (fn: any) =>
          fn({
            dispute: { update: jest.fn().mockResolvedValue({}) },
            escrowTransaction: { update: jest.fn().mockResolvedValue({}) },
            freelancerWallet: {
              upsert: jest.fn().mockResolvedValue({}),
              findUnique: jest.fn().mockResolvedValue({ id: 'fw1' }),
            },
            walletTransaction: { create: jest.fn().mockResolvedValue({}) },
            employerWallet: {
              findUnique: jest.fn().mockResolvedValue({ id: 'ew1' }),
              update: jest.fn().mockResolvedValue({}),
            },
            employerWalletTransaction: { create: jest.fn().mockResolvedValue({}) },
            contract: { update: jest.fn().mockResolvedValue({}) },
            eventLog: { create: jest.fn().mockResolvedValue({}) },
          }),
        ),
      });

      const result = await service.resolveDispute(
        'd1',
        'Freelancer completed 70% of the work satisfactorily',
        'PARTIAL_RELEASE',
        'admin-1',
        70,
      );

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
