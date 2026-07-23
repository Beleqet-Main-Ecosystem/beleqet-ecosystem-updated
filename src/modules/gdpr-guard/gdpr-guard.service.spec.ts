import { Test, TestingModule } from '@nestjs/testing';
import { GdprGuardService } from './gdpr-guard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockTx = {
  user: { update: jest.fn() },
  refreshToken: { deleteMany: jest.fn() },
  verificationToken: { deleteMany: jest.fn() },
  walletTransaction: { updateMany: jest.fn() },
  employerWalletTransaction: { updateMany: jest.fn() },
  eventLog: { create: jest.fn() },
};

const mockPrismaService = {
  user: { findUnique: jest.fn() },
  $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<void>) => cb(mockTx)),
};

describe('GdprGuardService', () => {
  let service: GdprGuardService;

  const audit = {
    reason: 'User requested account deletion under GDPR Article 17',
    actorUserId: 'admin-uuid-0000-0000-0000-000000000001',
  };

  beforeEach(async () => {
    process.env.GDPR_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const module: TestingModule = await Test.createTestingModule({
      providers: [GdprGuardService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<GdprGuardService>(GdprGuardService);
    jest.clearAllMocks();
  });

  it('should be defined and instantiate properly', () => {
    expect(service).toBeDefined();
  });

  describe('PII Cryptography', () => {
    it('should successfully encrypt and decrypt raw text using AES-256-GCM', () => {
      const rawText = 'Bemnet Derseh Ayalew';
      const encrypted = service.encryptPii(rawText);

      expect(encrypted).not.toEqual(rawText);
      expect(encrypted.split(':').length).toEqual(3);
      expect(service.decryptPii(encrypted)).toEqual(rawText);
    });

    it('should return empty/falsy values directly without error', () => {
      expect(service.encryptPii('')).toEqual('');
      expect(service.decryptPii('')).toEqual('');
    });
  });

  describe('executeDataErasure', () => {
    const mockUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('should scrub user PII, invalidate sessions, scrub wallet notes, and persist audit log', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: mockUuid,
        email: 'test@example.com',
        wallet: { id: 'wallet-1' },
        employerWallet: { id: 'employer-wallet-1' },
      });

      const result = await service.executeDataErasure(mockUuid, audit);

      expect(result.success).toBe(true);
      expect(result.referenceId).toBeDefined();
      expect(result.scrubbedAt).toBeDefined();

      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: mockUuid },
        data: expect.objectContaining({
          firstName: 'GDPR_ANONYMOUS',
          lastName: 'USER',
          phone: null,
          avatarUrl: null,
          telegramId: null,
          bio: null,
          skills: [],
          isActive: false,
        }),
      });
      expect(mockTx.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
      });
      expect(mockTx.verificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
      });
      expect(mockTx.walletTransaction.updateMany).toHaveBeenCalledWith({
        where: { walletId: 'wallet-1', note: { not: null } },
        data: { note: 'GDPR_SCRUBBED' },
      });
      expect(mockTx.employerWalletTransaction.updateMany).toHaveBeenCalledWith({
        where: { walletId: 'employer-wallet-1', note: { not: null } },
        data: { note: 'GDPR_SCRUBBED' },
      });
      expect(mockTx.eventLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'GDPR_DATA_ERASURE',
          entityId: mockUuid,
          entityType: 'User',
          processedBy: audit.actorUserId,
          payload: expect.objectContaining({
            reason: audit.reason,
            actorUserId: audit.actorUserId,
            targetUserId: mockUuid,
            referenceId: result.referenceId,
            scrubbedAt: result.scrubbedAt,
          }),
        }),
      });
    });

    it('should throw NotFoundException if the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.executeDataErasure(mockUuid, audit)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });
});
