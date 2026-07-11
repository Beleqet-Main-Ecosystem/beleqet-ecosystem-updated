import { Test, TestingModule } from '@nestjs/testing';
import { KycService } from './kyc.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { KycDocumentType, KycStatus } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { SubmitKycDto } from './dto/submit-kyc.dto';

describe('KycService (Unit Tests)', () => {
  let service: KycService;
  let prismaMock: any;
  let uploadsMock: any;
  let providerMock: any;

  beforeEach(async () => {
    // Rebuild transactional mock tree matching the Prisma $transaction context
    prismaMock = {
      kycVerification: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      user: { update: jest.fn() },
      eventLog: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    // Reflect current production method names exactly
    uploadsMock = {
      generatePresignedUrl: jest.fn().mockResolvedValue({
        key: 'secure-storage-key',
        presignedUrl: 'https://presigned-url.local',
      }),
      getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-binary-data')),
    };

    providerMock = {
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UploadsService, useValue: uploadsMock },
        { provide: 'KycProvider', useValue: providerMock },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
  });

  describe('createPresignedUploadTokens', () => {
    it('should generate dual secure targets for document and face scan objects', async () => {
      const result = await service.createPresignedUploadTokens('user-123');

      expect(uploadsMock.generatePresignedUrl).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('documentStorageKey');
      expect(result).toHaveProperty('faceScanStorageKey');
      expect(result).toHaveProperty('documentUploadUrl');
      expect(result).toHaveProperty('faceScanUploadUrl');
    });
  });

  describe('submitVerification', () => {
    const mockDto: SubmitKycDto = {
      documentType: KycDocumentType.PASSPORT,
      documentStorageKey: 'kyc-documents/ids/user-1-doc.jpg',
      faceScanStorageKey: 'kyc-documents/selfies/user-1-face.jpg',
    };

    it('should successfully auto-approve a submission when matching parameters meet standard criteria', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      // Simulate verification provider meeting automatic threshold benchmarks
      providerMock.verify.mockResolvedValue({
        matchScore: 95.0,
        livenessPassed: true,
        isDocumentValid: true,
        rejectionReason: null,
      });

      prismaMock.kycVerification.upsert.mockResolvedValue({
        status: KycStatus.APPROVED,
        matchScore: 95.0,
        livenessPassed: true,
        rejectionReason: null,
        verifiedAt: new Date(),
      });

      const result = await service.submitVerification('user-1', mockDto);

      expect(result.status).toBe(KycStatus.APPROVED);
      expect(uploadsMock.getFileBuffer).toHaveBeenCalledTimes(2);
      expect(providerMock.verify).toHaveBeenCalledWith({
        documentBuffer: expect.any(Buffer),
        faceScanBuffer: expect.any(Buffer),
        documentMimeType: 'image/jpeg',
        faceScanMimeType: 'image/jpeg',
      });
      expect(prismaMock.kycVerification.upsert).toHaveBeenCalled();
    });

    it('should auto-reject a submission if security score falls under the minimum allowed parameter threshold', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      // Simulating failing engine criteria scores
      providerMock.verify.mockResolvedValue({
        matchScore: 42.0,
        livenessPassed: true,
        isDocumentValid: true,
        rejectionReason: 'Score below safety guidelines.',
      });

      prismaMock.kycVerification.upsert.mockResolvedValue({
        status: KycStatus.REJECTED,
        matchScore: 42.0,
        livenessPassed: true,
        rejectionReason: 'Score below safety guidelines.',
        verifiedAt: null,
      });

      const result = await service.submitVerification('user-2', mockDto);

      expect(result.status).toBe(KycStatus.REJECTED);
      expect(result.rejectionReason).toBe('Score below safety guidelines.');
    });

    it('should drop processing execution and raise a ConflictException if a target verification transaction is already pending', async () => {
      // Simulate an active pending identity verification step blocking pipeline
      prismaMock.kycVerification.findUnique.mockResolvedValue({
        status: KycStatus.PENDING,
      });

      await expect(service.submitVerification('user-3', mockDto)).rejects.toThrow(
        ConflictException,
      );

      expect(uploadsMock.getFileBuffer).not.toHaveBeenCalled();
      expect(providerMock.verify).not.toHaveBeenCalled();
    });
  });
});
