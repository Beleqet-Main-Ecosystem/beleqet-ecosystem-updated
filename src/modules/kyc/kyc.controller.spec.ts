import { Test, TestingModule } from '@nestjs/testing';

import { KycController } from './kyc.controller';

import { KycService } from './kyc.service';

import { KycDocumentType, KycStatus } from '@prisma/client';

import { SubmitKycDto } from './dto/submit-kyc.dto';
import { RejectKycDto } from './dto/reject-kyc.dto';

const mockKycService = {
  generateUploadUrls: jest.fn(),

  submitVerification: jest.fn(),

  getVerificationStatus: jest.fn(),

  getPendingVerifications: jest.fn(),

  approveVerification: jest.fn(),

  rejectVerification: jest.fn(),
};

describe('KycController', () => {
  let controller: KycController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KycController],

      providers: [
        {
          provide: KycService,
          useValue: mockKycService,
        },
      ],
    }).compile();

    controller = module.get<KycController>(KycController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateUploadUrls', () => {
    it('should generate temporary upload URLs', async () => {
      const mockUser = {
        userId: 'user-1',
      };

      const expectedResponse = {
        documentUploadUrl: 'https://upload-url.com/doc',

        faceScanUploadUrl: 'https://upload-url.com/face',

        documentStorageKey: 'kyc/doc.jpg',

        faceScanStorageKey: 'kyc/face.jpg',
      };

      mockKycService.generateUploadUrls.mockResolvedValue(expectedResponse);

      const result = await controller.generateUploadUrls(
        mockUser as any,
        {
          documentContentType: 'image/jpeg',

          faceScanContentType: 'image/png',
        } as any,
      );

      expect(result).toEqual(expectedResponse);

      expect(mockKycService.generateUploadUrls).toHaveBeenCalledWith(
        'user-1',

        'image/jpeg',

        'image/png',
      );
    });
  });

  describe('submitVerification', () => {
    it('should submit KYC verification request', async () => {
      const mockUser = {
        userId: 'user-1',
      };

      const dto: SubmitKycDto = {
        documentType: KycDocumentType.PASSPORT,

        documentStorageKey: 'kyc/doc.jpg',

        faceScanStorageKey: 'kyc/face.jpg',

        documentMimeType: 'image/jpeg',

        faceScanMimeType: 'image/jpeg',
      };

      mockKycService.submitVerification.mockResolvedValue({
        status: KycStatus.PENDING,
      });

      const result = await controller.submitVerification(mockUser as any, dto);

      expect(result.status).toBe(KycStatus.PENDING);

      expect(mockKycService.submitVerification).toHaveBeenCalledWith(
        'user-1',

        dto,
      );
    });
  });

  describe('getStatus', () => {
    it('should return current KYC status', async () => {
      const mockUser = {
        userId: 'user-1',
      };

      mockKycService.getVerificationStatus.mockResolvedValue({
        status: KycStatus.PENDING,
      });

      const result = await controller.getVerificationStatus(mockUser as any);

      expect(result.status).toBe(KycStatus.PENDING);

      expect(mockKycService.getVerificationStatus).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getPending', () => {
    it('should retrieve pending KYC submissions for admin review', async () => {
      const pendingRecords = [
        {
          id: 'kyc-1',

          status: KycStatus.PENDING,
        },
      ];

      mockKycService.getPendingVerifications.mockResolvedValue(pendingRecords);

      const result = await controller.getPendingVerifications();

      expect(result).toEqual(pendingRecords);

      expect(mockKycService.getPendingVerifications).toHaveBeenCalled();
    });
  });

  describe('admin actions', () => {
    const admin = {
      userId: 'admin-1',

      role: 'ADMIN',
    };

    it('should approve verification', async () => {
      mockKycService.approveVerification.mockResolvedValue({
        status: KycStatus.APPROVED,
      });

      const result = await controller.approve('kyc-1', admin as any);

      expect(result.status).toBe(KycStatus.APPROVED);

      expect(mockKycService.approveVerification).toHaveBeenCalledWith(
        'kyc-1',

        'admin-1',
      );
    });

    it('should reject verification', async () => {
      const dto: RejectKycDto = {
        reason: 'Invalid identity document',
      };

      mockKycService.rejectVerification.mockResolvedValue({
        status: KycStatus.REJECTED,
      });

      const result = await controller.reject(
        { id: 'kyc-1' } as any,

        admin as any,

        dto,
      );

      expect(result.status).toBe(KycStatus.REJECTED);

      expect(mockKycService.rejectVerification).toHaveBeenCalledWith(
        'kyc-1',

        'admin-1',

        'Invalid identity document',
      );
    });
  });
});
