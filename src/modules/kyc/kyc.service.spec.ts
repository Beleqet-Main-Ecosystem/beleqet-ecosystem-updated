import { Test, TestingModule } from '@nestjs/testing';
import { KycService } from './kyc.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { I18nService } from 'nestjs-i18n';
import { KycDocumentType, KycStatus } from '@prisma/client';

import { ConflictException } from '@nestjs/common';

import { SubmitKycDto } from './dto/submit-kyc.dto';

describe('KycService (Unit Tests)', () => {
  let service: KycService;

  let prismaMock: any;
  let uploadsMock: any;
  let providerMock: any;
  let i18nMock: any;

  beforeEach(async () => {
    prismaMock = {
      kycVerification: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },

      user: {
        update: jest.fn(),
      },

      eventLog: {
        create: jest.fn(),
      },

      $transaction: jest.fn(async (callback) => callback(prismaMock)),
    };

    uploadsMock = {
      generateUploadUrl: jest.fn().mockResolvedValue({
        key: 'secure-storage-key',
        uploadUrl: 'https://upload-url.local',
      }),

      generateDownloadUrl: jest.fn().mockResolvedValue('https://download-url.local'),

      getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-binary-data')),
    };

    providerMock = {
      verify: jest.fn(),
    };

    i18nMock = {
      translate: jest.fn().mockResolvedValue('Translated message'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,

        {
          provide: PrismaService,
          useValue: prismaMock,
        },

        {
          provide: UploadsService,
          useValue: uploadsMock,
        },

        {
          provide: I18nService,
          useValue: i18nMock,
        },

        {
          provide: 'KycProvider',
          useValue: providerMock,
        },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
  });

  describe('generateUploadUrls', () => {
    it('should generate secure upload URLs for document and face scan', async () => {
      const result = await service.generateUploadUrls('user-123', 'image/jpeg', 'image/png');

      expect(uploadsMock.generateUploadUrl).toHaveBeenCalledTimes(2);

      expect(result).toHaveProperty('documentStorageKey');

      expect(result).toHaveProperty('faceScanStorageKey');

      expect(result).toHaveProperty('documentUploadUrl');

      expect(result).toHaveProperty('faceScanUploadUrl');
    });
    it('should throw translated error when document file type is invalid', async () => {
      i18nMock.translate.mockResolvedValue('Invalid file type');

      await expect(
        service.generateUploadUrls('user-1', 'application/pdf', 'image/jpeg'),
      ).rejects.toThrow('Invalid file type');

      expect(i18nMock.translate).toHaveBeenCalledWith('uploads.invalid_file_type');
    });

    it('should throw translated error when face scan file type is invalid', async () => {
      i18nMock.translate.mockResolvedValue('Invalid file type');

      await expect(
        service.generateUploadUrls('user-1', 'image/jpeg', 'application/pdf'),
      ).rejects.toThrow('Invalid file type');

      expect(i18nMock.translate).toHaveBeenCalledWith('uploads.invalid_file_type');
    });
  });

  describe('submitVerification', () => {
    const mockDto: SubmitKycDto = {
      documentType: KycDocumentType.PASSPORT,

      documentStorageKey: 'kyc-documents/ids/user-1-doc.jpg',

      faceScanStorageKey: 'kyc-documents/selfies/user-1-face.jpg',

      documentMimeType: 'image/jpeg',

      faceScanMimeType: 'image/jpeg',
    };

    it('should auto approve valid verification', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      providerMock.verify.mockResolvedValue({
        matchScore: 95,

        livenessPassed: true,

        isDocumentValid: true,

        rejectionReason: null,
      });

      prismaMock.kycVerification.upsert.mockResolvedValue({
        status: KycStatus.APPROVED,

        matchScore: 95,

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
    });

    it('should auto reject invalid verification score', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      providerMock.verify.mockResolvedValue({
        matchScore: 42,

        livenessPassed: true,

        isDocumentValid: true,

        rejectionReason: 'Score below safety guidelines.',
      });

      prismaMock.kycVerification.upsert.mockResolvedValue({
        status: KycStatus.REJECTED,

        matchScore: 42,

        rejectionReason: 'Score below safety guidelines.',
      });

      const result = await service.submitVerification('user-2', mockDto);

      expect(result.status).toBe(KycStatus.REJECTED);

      expect(result.rejectionReason).toBe('Score below safety guidelines.');
    });

    it('should reject duplicate pending verification', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue({
        status: KycStatus.PENDING,
      });

      await expect(service.submitVerification('user-3', mockDto)).rejects.toThrow(
        ConflictException,
      );

      expect(uploadsMock.getFileBuffer).not.toHaveBeenCalled();

      expect(providerMock.verify).not.toHaveBeenCalled();
    });
    it('should return translated message when verification is already pending', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue({
        status: KycStatus.PENDING,
      });

      i18nMock.translate.mockResolvedValue('Verification already pending');

      await expect(service.submitVerification('user-1', mockDto)).rejects.toThrow(
        'Verification already pending',
      );

      expect(i18nMock.translate).toHaveBeenCalledWith('uploads.already_pending');
    });
    it('should return translated error when uploaded files cannot be retrieved', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      uploadsMock.getFileBuffer.mockRejectedValue(new Error('Storage error'));

      i18nMock.translate.mockResolvedValue('Invalid upload reference');

      await expect(service.submitVerification('user-1', mockDto)).rejects.toThrow(
        'Invalid upload reference',
      );

      expect(i18nMock.translate).toHaveBeenCalledWith('uploads.invalid_upload_reference');
    });
    it('should reject submission when user is already verified', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue({
        status: KycStatus.APPROVED,
      });

      await expect(service.submitVerification('user-1', mockDto)).rejects.toThrow(
        ConflictException,
      );
    });
    it('should reject when uploaded files cannot be retrieved', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      uploadsMock.getFileBuffer.mockRejectedValue(new Error('File missing'));

      await expect(service.submitVerification('user-1', mockDto)).rejects.toThrow();

      expect(i18nMock.translate).toHaveBeenCalledWith('uploads.invalid_upload_reference');
    });
    it('should throw when KYC provider fails', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      providerMock.verify.mockRejectedValue(new Error('Provider unavailable'));

      await expect(service.submitVerification('user-1', mockDto)).rejects.toThrow(
        'Provider unavailable',
      );
    });
    it('should generate automatic rejection reason when provider does not provide one', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      providerMock.verify.mockResolvedValue({
        matchScore: 30,
        livenessPassed: false,
        isDocumentValid: false,
        rejectionReason: null,
      });

      prismaMock.kycVerification.upsert.mockResolvedValue({
        status: KycStatus.REJECTED,
        rejectionReason: expect.any(String),
      });

      const result = await service.submitVerification('user-1', mockDto);

      expect(result.status).toBe(KycStatus.REJECTED);
    });
  });
  describe('getPendingVerifications', () => {
    it('should return pending KYC records with secure download URLs', async () => {
      prismaMock.kycVerification.findMany.mockResolvedValue([
        {
          id: 'kyc-1',
          userId: 'user-1',
          documentUrl: 'kyc-documents/ids/id-card.jpg',
          faceScanUrl: 'kyc-documents/selfies/selfie.jpg',
          status: KycStatus.PENDING,

          user: {
            id: 'user-1',
            email: 'user@test.com',
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ]);

      const result = await service.getPendingVerifications();

      expect(prismaMock.kycVerification.findMany).toHaveBeenCalledWith({
        where: {
          status: KycStatus.PENDING,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      expect(result).toHaveLength(1);

      expect(result[0].documentUrl).toBe('https://download-url.local');

      expect(result[0].faceScanUrl).toBe('https://download-url.local');

      expect(uploadsMock.generateDownloadUrl).toHaveBeenCalledTimes(2);
    });
    it('should return empty array when no pending KYC exists', async () => {
      prismaMock.kycVerification.findMany.mockResolvedValue([]);

      const result = await service.getPendingVerifications();

      expect(result).toEqual([]);
    });
  });
  describe('approveVerification', () => {
    it('should approve KYC verification and update user verification status', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue({
        id: 'kyc-123',

        userId: 'user-123',

        status: KycStatus.PENDING,
      });

      prismaMock.kycVerification.update.mockResolvedValue({
        id: 'kyc-123',

        status: KycStatus.APPROVED,

        verifiedAt: new Date(),
      });

      const result = await service.approveVerification('kyc-123', 'admin-123');

      expect(prismaMock.kycVerification.update).toHaveBeenCalledWith({
        where: {
          id: 'kyc-123',
        },

        data: {
          status: KycStatus.APPROVED,

          rejectionReason: null,

          verifiedAt: expect.any(Date),
        },
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: {
          id: 'user-123',
        },

        data: {
          kycVerified: true,
        },
      });

      expect(prismaMock.eventLog.create).toHaveBeenCalled();

      expect(result.status).toBe(KycStatus.APPROVED);
    });
    it('should return translated error when KYC record does not exist', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      i18nMock.translate.mockResolvedValue('KYC record not found');

      await expect(service.approveVerification('invalid-id', 'admin-1')).rejects.toThrow(
        'KYC record not found',
      );

      expect(i18nMock.translate).toHaveBeenCalledWith('uploads.not_found');
    });
    it('should fail if transaction fails', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue({
        id: 'kyc-1',
        userId: 'user-1',
      });

      prismaMock.kycVerification.update.mockRejectedValue(new Error('DB error'));

      await expect(service.approveVerification('kyc-1', 'admin-1')).rejects.toThrow();
    });
  });
  describe('rejectVerification', () => {
    it('should reject KYC verification with admin reason', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue({
        id: 'kyc-123',

        userId: 'user-123',

        status: KycStatus.PENDING,
      });

      prismaMock.kycVerification.update.mockResolvedValue({
        id: 'kyc-123',

        status: KycStatus.REJECTED,

        rejectionReason: 'Invalid document',
      });

      const result = await service.rejectVerification('kyc-123', 'admin-123', 'Invalid document');

      expect(prismaMock.kycVerification.update).toHaveBeenCalled();

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: {
          id: 'user-123',
        },

        data: {
          kycVerified: false,
        },
      });

      expect(result.status).toBe(KycStatus.REJECTED);
    });

    it('should return translated error when rejection reason is missing', async () => {
      i18nMock.translate.mockResolvedValue('Rejection reason is required');

      await expect(service.rejectVerification('kyc-1', 'admin-1', '')).rejects.toThrow(
        'Rejection reason is required',
      );

      expect(i18nMock.translate).toHaveBeenCalledWith('uploads.rejection_reason_required');
    });

    it('should return translated error when rejecting unknown KYC record', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      i18nMock.translate.mockResolvedValue('KYC record not found');

      await expect(
        service.rejectVerification('invalid-id', 'admin-1', 'Invalid document'),
      ).rejects.toThrow('KYC record not found');

      expect(i18nMock.translate).toHaveBeenCalledWith('uploads.not_found');
    });
    it('should reject whitespace-only reason', async () => {
      await expect(service.rejectVerification('kyc-1', 'admin-1', '     ')).rejects.toThrow();
    });
  });
  describe('getVerificationStatus', () => {
    it('should return user KYC record', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue({
        status: KycStatus.APPROVED,
      });

      const result = await service.getVerificationStatus('user-1');

      expect(result.status).toBe(KycStatus.APPROVED);
    });
    it('should throw when KYC record does not exist', async () => {
      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      await expect(service.getVerificationStatus('user-1')).rejects.toThrow();
    });
  });
});
