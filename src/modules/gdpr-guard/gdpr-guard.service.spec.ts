// src/modules/gdpr-guard/gdpr-guard.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { GdprGuardService } from './gdpr-guard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

// 1. To mock the PrismaService user model for testing
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

describe('GdprGuardService', () => {
  let service: GdprGuardService;

  beforeEach(async () => {
    // 2. To set the AES-256-GCM encryption key in the environment
    process.env.GDPR_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GdprGuardService,
        // To inject the mock PrismaService
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<GdprGuardService>(GdprGuardService);

    // To clear all mocks after each test
    jest.clearAllMocks();
  });

  it('should be defined and instantiate properly', () => {
    expect(service).toBeDefined();
  });

  // 3. To test the Cryptography (Encryption/Decryption) logic
  describe('PII Cryptography', () => {
    it('should successfully encrypt and decrypt raw text using AES-256-GCM', () => {
      const rawText = 'Bemnet Derseh Ayalew';
      const encrypted = service.encryptPii(rawText);

      // To check if the encrypted text is different from the raw text
      expect(encrypted).not.toEqual(rawText);
      // To check if the encrypted text has the correct format 'iv:tag:cipherText'
      expect(encrypted.split(':').length).toEqual(3);

      const decrypted = service.decryptPii(encrypted);
      // To check if the decrypted text is the same as the raw text
      expect(decrypted).toEqual(rawText);
    });

    it('should return empty/falsy values directly without error', () => {
      expect(service.encryptPii('')).toEqual('');
      expect(service.decryptPii('')).toEqual('');
    });
  });

  // 4. To test the GDPR Data Erasure / Anonymization logic
  describe('executeDataErasure', () => {
    const mockUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('should successfully anonymize user PII data when user exists', async () => {
      // To mock the user data when it exists in the database
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: mockUuid,
        email: 'test@example.com',
      });
      mockPrismaService.user.update.mockResolvedValue({ id: mockUuid });

      const result = await service.executeDataErasure(mockUuid);

      // To check if the result is successful
      expect(result.success).toBe(true);
      expect(result.referenceId).toBeDefined();
      expect(result.scrubbedAt).toBeDefined();

      // To check if the user update function was called
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUuid },
        data: expect.objectContaining({
          firstName: 'GDPR_ANONYMOUS',
          lastName: 'USER',
          phone: '0000000000',
        }),
      });
    });

    it('should throw NotFoundException if the user does not exist', async () => {
      // To mock the user data when it does not exist in the database
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.executeDataErasure(mockUuid)).rejects.toThrow(NotFoundException);
      // To check if the user update function was not called
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });
  });
});
