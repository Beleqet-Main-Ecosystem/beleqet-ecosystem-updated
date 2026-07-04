import { Test, TestingModule } from '@nestjs/testing';
import { KycService } from './kyc.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { KycDocumentType, KycStatus } from '@prisma/client';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  kycVerification: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  user: {
    update: jest.fn(),
  },
  eventLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

mockPrismaService.$transaction.mockImplementation((callback: (tx: unknown) => unknown) => callback(mockPrismaService));

const mockUploadsService = {
  uploadFile: jest.fn(() => Promise.resolve({ publicUrl: 'https://storage.com/file.jpg', key: 'file.jpg' })),
};

const mockKycProvider = {
  verify: jest.fn(),
};

describe('KycService', () => {
  let service: KycService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UploadsService, useValue: mockUploadsService },
        { provide: 'KycProvider', useValue: mockKycProvider },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submitVerification', () => {
    const mockFile = { buffer: Buffer.from('test'), originalname: 'test.jpg', mimetype: 'image/jpeg' };

    it('should throw BadRequestException if files are missing', async () => {
      await expect(
        service.submitVerification('user-1', KycDocumentType.PASSPORT, null, mockFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if user is already verified', async () => {
      mockPrismaService.kycVerification.findUnique.mockResolvedValue({
        status: KycStatus.APPROVED,
      });

      await expect(
        service.submitVerification('user-1', KycDocumentType.PASSPORT, mockFile, mockFile),
      ).rejects.toThrow(ConflictException);
    });

    it('should auto-approve when provider matching score is above auto-approve threshold', async () => {
      mockPrismaService.kycVerification.findUnique.mockResolvedValue(null);
      mockKycProvider.verify.mockResolvedValue({
        matchScore: 85.0,
        livenessPassed: true,
        isDocumentValid: true,
      });
      mockPrismaService.kycVerification.upsert.mockResolvedValue({
        status: KycStatus.APPROVED,
        matchScore: 85.0,
        livenessPassed: true,
      });

      const result = await service.submitVerification('user-1', KycDocumentType.PASSPORT, mockFile, mockFile);

      expect(result.status).toBe(KycStatus.APPROVED);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { kycVerified: true },
      });
    });

    it('should reject when match score is below auto-reject threshold', async () => {
      mockPrismaService.kycVerification.findUnique.mockResolvedValue(null);
      mockKycProvider.verify.mockResolvedValue({
        matchScore: 45.0,
        livenessPassed: true,
        isDocumentValid: true,
      });
      mockPrismaService.kycVerification.upsert.mockResolvedValue({
        status: KycStatus.REJECTED,
        matchScore: 45.0,
        livenessPassed: true,
      });

      const result = await service.submitVerification('user-1', KycDocumentType.PASSPORT, mockFile, mockFile);

      expect(result.status).toBe(KycStatus.REJECTED);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { kycVerified: false },
      });
    });
  });

  describe('admin overrides', () => {
    it('should approve kyc verification manually', async () => {
      mockPrismaService.kycVerification.findUnique.mockResolvedValue({ id: 'kyc-1', userId: 'user-1' });
      mockPrismaService.kycVerification.update.mockResolvedValue({ id: 'kyc-1', status: KycStatus.APPROVED });

      const result = await service.approveVerification('kyc-1', 'admin-1');

      expect(result.status).toBe(KycStatus.APPROVED);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { kycVerified: true },
      });
    });

    it('should reject kyc verification manually', async () => {
      mockPrismaService.kycVerification.findUnique.mockResolvedValue({ id: 'kyc-1', userId: 'user-1' });
      mockPrismaService.kycVerification.update.mockResolvedValue({ id: 'kyc-1', status: KycStatus.REJECTED });

      const result = await service.rejectVerification('kyc-1', 'admin-1', 'ID not readable');

      expect(result.status).toBe(KycStatus.REJECTED);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { kycVerified: false },
      });
    });
  });
});
