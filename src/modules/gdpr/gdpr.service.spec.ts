import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { GdprService } from './gdpr.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('GdprService', () => {
  let service: GdprService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: any) => unknown) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<GdprService>(GdprService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('exportUserData', () => {
    it('should export user data successfully', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: 'hashed',
        applications: [],
        bids: [],
        company: null,
        freelanceJobs: [],
        contractsAsClient: [],
        contractsAsFreelancer: [],
        notifications: [],
        savedJobs: [],
        wallet: null,
        employerWallet: null,
        cvDraft: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.exportUserData('user-1');

      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('exportedAt');
      expect(result).toHaveProperty('version', '1.0');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.exportUserData('user-1')).rejects.toThrow(
        'User not found',
      );
    });
  });

  describe('deleteUserAccount', () => {
    it('should delete and anonymize user account', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
      };

      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.deleteUserAccount('user-1');

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('userId', 'user-1');
      expect(result).toHaveProperty('deletedAt');
    });
  });

  describe('getConsents', () => {
    it('should get user consent preferences', async () => {
      const mockConsents = {
        id: 'user-1',
        email: 'test@example.com',
        consentMarketing: true,
        consentAnalytics: false,
        consentDataProcessing: true,
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockConsents);

      const result = await service.getConsents('user-1');

      expect(result).toHaveProperty('consentMarketing');
      expect(result).toHaveProperty('consentAnalytics');
      expect(result).toHaveProperty('consentDataProcessing');
    });
  });
});