import { Test, TestingModule } from '@nestjs/testing';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';

import { KycDocumentType, KycStatus } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

describe('KYC Module Flow Integration', () => {
  let controller: KycController;

  let prismaMock: any;
  let uploadsMock: any;
  let providerMock: any;

  const mockUser: CurrentUserPayload = {
    userId: 'usr-dev-123',
    email: 'freelancer@network.et',
    role: 'FREELANCER',
  };

  beforeEach(async () => {
    prismaMock = {
      kycVerification: {
        findUnique: jest.fn(),

        upsert: jest.fn(),

        findMany: jest.fn(),

        update: jest.fn(),
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
        key: 'kyc-storage-key',

        uploadUrl: 'https://secure-upload-url.com',
      }),

      getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('valid-image-buffer')),
    };

    providerMock = {
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KycController],

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
          provide: 'KycProvider',

          useValue: providerMock,
        },
        {
          provide: I18nService,
          useValue: {
            translate: jest.fn((key) => key),
          },
        },
      ],
    }).compile();

    controller = module.get<KycController>(KycController);
  });

  describe('submitKyc flow', () => {
    it('should complete successful KYC verification flow', async () => {
      const dto: SubmitKycDto = {
        documentType: KycDocumentType.PASSPORT,

        documentStorageKey: 'kyc-documents/passport.jpg',

        faceScanStorageKey: 'kyc-documents/selfie.jpg',

        documentMimeType: 'image/jpeg',

        faceScanMimeType: 'image/jpeg',
      };

      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      providerMock.verify.mockResolvedValue({
        matchScore: 95.8,

        livenessPassed: true,

        isDocumentValid: true,

        rejectionReason: null,
      });

      prismaMock.kycVerification.upsert.mockResolvedValue({
        status: KycStatus.APPROVED,

        matchScore: 95.8,

        livenessPassed: true,

        rejectionReason: null,

        verifiedAt: new Date(),
      });

      const result = await controller.submitVerification(mockUser, dto);

      expect(result.status).toBe(KycStatus.APPROVED);

      expect(result.matchScore).toBe(95.8);

      expect(result.livenessPassed).toBe(true);

      expect(uploadsMock.getFileBuffer).toHaveBeenCalledTimes(2);

      expect(providerMock.verify).toHaveBeenCalledWith({
        documentBuffer: expect.any(Buffer),

        faceScanBuffer: expect.any(Buffer),

        documentMimeType: 'image/jpeg',

        faceScanMimeType: 'image/jpeg',
      });
    });

    it('should complete rejected KYC verification flow', async () => {
      const dto: SubmitKycDto = {
        documentType: KycDocumentType.NATIONAL_ID,

        documentStorageKey: 'kyc-documents/id-card.jpg',

        faceScanStorageKey: 'kyc-documents/selfie.jpg',

        documentMimeType: 'image/jpeg',

        faceScanMimeType: 'image/jpeg',
      };

      prismaMock.kycVerification.findUnique.mockResolvedValue(null);

      providerMock.verify.mockResolvedValue({
        matchScore: 42,

        livenessPassed: true,

        isDocumentValid: true,

        rejectionReason: 'Low biometric match score',
      });

      prismaMock.kycVerification.upsert.mockResolvedValue({
        status: KycStatus.REJECTED,

        matchScore: 42,

        livenessPassed: true,

        rejectionReason: 'Low biometric match score',
      });

      const result = await controller.submitVerification(mockUser, dto);

      expect(result.status).toBe(KycStatus.REJECTED);

      expect(result.matchScore).toBe(42);

      expect(result.rejectionReason).toBe('Low biometric match score');
    });

    it('should block already pending verification', async () => {
      const dto: SubmitKycDto = {
        documentType: KycDocumentType.PASSPORT,

        documentStorageKey: 'document.jpg',

        faceScanStorageKey: 'selfie.jpg',

        documentMimeType: 'image/jpeg',

        faceScanMimeType: 'image/jpeg',
      };

      prismaMock.kycVerification.findUnique.mockResolvedValue({
        status: KycStatus.PENDING,
      });

      await expect(controller.submitVerification(mockUser, dto)).rejects.toThrow();

      expect(uploadsMock.getFileBuffer).not.toHaveBeenCalled();
    });
  });
});
