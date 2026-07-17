import { Test, TestingModule } from '@nestjs/testing';
import { GDPRService } from './gdpr.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('GDPRService', () => {
  let service: GDPRService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GDPRService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            gdprConsent: {
              create: jest.fn(),
            },
            paymentTransaction: {
              findMany: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<GDPRService>(GDPRService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  describe('getComplianceMetadata', () => {
    it('should return GDPR compliance metadata', async () => {
      const metadata = await service.getComplianceMetadata('cus_123');

      expect(metadata).toBeDefined();
      expect(metadata.dataProcessingAgreement).toBe(true);
      expect(metadata.consentObtained).toBe(true);
      expect(metadata.purposeLimitation).toBe('payment');
      expect(metadata.retentionDays).toBe(90);
      expect(metadata.isPersonalData).toBe(true);
    });
  });

  describe('checkConsentStatus', () => {
    it('should return true if user has valid consent', async () => {
      const mockUser = {
        id: 'user_123',
        gdprConsentDate: new Date(),
        gdprConsentRevoked: false,
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.checkConsentStatus('user_123');

      expect(result).toBe(true);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        select: {
          gdprConsentDate: true,
          gdprConsentRevoked: true,
        },
      });
    });

    it('should return false if user has revoked consent', async () => {
      const mockUser = {
        id: 'user_123',
        gdprConsentDate: new Date(),
        gdprConsentRevoked: true,
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      const result = await service.checkConsentStatus('user_123');

      expect(result).toBe(false);
    });

    it('should return false if user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.checkConsentStatus('nonexistent_user');

      expect(result).toBe(false);
    });
  });

  describe('recordConsent', () => {
    it('should record user consent for data processing', async () => {
      prismaService.gdprConsent.create.mockResolvedValue({} as any);

      await service.recordConsent('user_123', 'payment');

      expect(prismaService.gdprConsent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user_123',
          purpose: 'payment',
          version: '1.0',
          consentedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('revokeConsent', () => {
    it('should revoke user consent', async () => {
      prismaService.user.update.mockResolvedValue({} as any);

      await service.revokeConsent('user_123');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: {
          gdprConsentRevoked: true,
          gdprConsentRevokedAt: expect.any(Date),
        },
      });
    });
  });

  describe('getDataSubjectAccess', () => {
    it('should return user data for GDPR subject access request', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '1234567890',
        createdAt: new Date(),
        gdprConsentDate: new Date(),
      };

      const mockTransactions = [
        {
          id: 'txn_1',
          amount: 100,
          currency: 'USD',
          status: 'completed',
          createdAt: new Date(),
        },
      ];

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.paymentTransaction.findMany.mockResolvedValue(mockTransactions as any);

      const result = await service.getDataSubjectAccess('user_123');

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.transactions).toBeDefined();
      expect(result.exportedAt).toBeInstanceOf(Date);
      expect(result.transactions.length).toBe(1);
    });
  });

  describe('deleteUserData', () => {
    it('should anonymize user data for right to be forgotten', async () => {
      prismaService.user.update.mockResolvedValue({} as any);
      prismaService.paymentTransaction.updateMany.mockResolvedValue({} as any);

      await service.deleteUserData('user_123');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: expect.objectContaining({
          email: expect.stringMatching(/^deleted-.*@anonymous\.local$/),
          firstName: 'DELETED',
          lastName: 'USER',
          phone: null,
        }),
      });

      expect(prismaService.paymentTransaction.updateMany).toHaveBeenCalledWith({
        where: { externalCustomerId: 'user_123' },
        data: {
          externalCustomerId: expect.stringMatching(/^DELETED-user_123$/),
        },
      });
    });
  });

  describe('validateDataMinimization', () => {
    it('should identify PII fields in payload', () => {
      const payload = {
        email: 'test@example.com',
        phone: '1234567890',
        amount: 100,
        currency: 'USD',
      };

      const piiFields = service.validateDataMinimization(payload);

      expect(piiFields).toBeDefined();
      expect(Array.isArray(piiFields)).toBe(true);
    });

    it('should handle payloads without PII', () => {
      const payload = {
        amount: 100,
        currency: 'USD',
        status: 'completed',
      };

      const piiFields = service.validateDataMinimization(payload);

      expect(piiFields).toBeDefined();
      expect(Array.isArray(piiFields)).toBe(true);
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask sensitive data fields', () => {
      const payload = {
        cardNumber: '4111111111111111',
        email: 'test@example.com',
        amount: 100,
      };

      const masked = service.maskSensitiveData(payload);

      expect(masked).toBeDefined();
      expect(masked.cardNumber).not.toBe(payload.cardNumber);
      expect(masked.email).not.toBe(payload.email);
      expect(masked.amount).toBe(payload.amount); // Non-sensitive data unchanged
    });
  });

  describe('scheduleDataDeletion', () => {
    it('should schedule data deletion for specified days', async () => {
      const transactionId = 'txn_123';
      const retentionDays = 90;

      prismaService.paymentTransaction.updateMany.mockResolvedValue({} as any);

      await service.scheduleDataDeletion(transactionId, retentionDays);

      expect(prismaService.paymentTransaction.updateMany).toHaveBeenCalled();
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate GDPR compliance report for user', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        createdAt: new Date(),
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.paymentTransaction.findMany.mockResolvedValue([] as any);

      const report = await service.generateComplianceReport('user_123');

      expect(report).toBeDefined();
      expect(report.userId).toBe('user_123');
      expect(report.reportDate).toBeInstanceOf(Date);
    });
  });
});
