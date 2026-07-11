import { Test, TestingModule } from '@nestjs/testing';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { RejectKycDto } from './dto/reject-kyc.dto';
import { KycDocumentType, KycStatus } from '@prisma/client';

const mockKycService = {
  createPresignedUploadTokens: jest.fn(),
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
      providers: [{ provide: KycService, useValue: mockKycService }],
    }).compile();

    controller = module.get<KycController>(KycController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUploadUrls', () => {
    it('should request ephemeral presigned S3 URLs from the service layer', async () => {
      const mockUser = { userId: 'user-1', email: 'test@beleqet.com', role: 'FREELANCER' };
      const expectedTokens = {
        documentUploadUrl: 'https://s3.amazonaws.com/upload-doc-link',
        faceScanUploadUrl: 'https://s3.amazonaws.com/upload-face-link',
        documentStorageKey: 'kyc/user-1/doc.jpg',
        faceScanStorageKey: 'kyc/user-1/face.jpg',
      };

      mockKycService.createPresignedUploadTokens.mockResolvedValue(expectedTokens);

      const result = await controller.getUploadUrls(mockUser);

      expect(result).toEqual(expectedTokens);
      expect(mockKycService.createPresignedUploadTokens).toHaveBeenCalledWith('user-1');
    });
  });

  describe('submitKyc', () => {
    const mockUser = { userId: 'user-1', email: 'test@beleqet.com', role: 'FREELANCER' };

    it('should submit verification details smoothly when validation checks clear tracking DTO payload', async () => {
      const dto: SubmitKycDto = {
        documentType: KycDocumentType.PASSPORT,
        documentStorageKey: 'vault/kyc/passport-doc-hash.jpg',
        faceScanStorageKey: 'vault/kyc/face-scan-hash.jpg',
      };

      mockKycService.submitVerification.mockResolvedValue({ status: KycStatus.PENDING });

      const result = await controller.submitKyc(mockUser, dto);

      expect(result.status).toBe(KycStatus.PENDING);
      expect(mockKycService.submitVerification).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('getStatus', () => {
    it('should return user status from service', async () => {
      const mockUser = { userId: 'user-1', email: 'test@beleqet.com', role: 'FREELANCER' };
      mockKycService.getVerificationStatus.mockResolvedValue({ status: KycStatus.PENDING });

      const result = await controller.getStatus(mockUser);

      expect(result.status).toBe(KycStatus.PENDING);
      expect(mockKycService.getVerificationStatus).toHaveBeenCalledWith('user-1');
    });
  });

  describe('admin manual overrides', () => {
    const mockAdmin = { userId: 'admin-1', email: 'admin@beleqet.com', role: 'ADMIN' };

    it('should invoke approve verification service', async () => {
      mockKycService.approveVerification.mockResolvedValue({ status: KycStatus.APPROVED });

      const result = await controller.approve('kyc-1', mockAdmin);

      expect(result.status).toBe(KycStatus.APPROVED);
      expect(mockKycService.approveVerification).toHaveBeenCalledWith('kyc-1', 'admin-1');
    });

    it('should invoke reject verification service', async () => {
      const dto: RejectKycDto = { reason: 'ID matching metadata profile mismatch' };
      mockKycService.rejectVerification.mockResolvedValue({ status: KycStatus.REJECTED });

      const result = await controller.reject('kyc-1', mockAdmin, dto);

      expect(result.status).toBe(KycStatus.REJECTED);
      expect(mockKycService.rejectVerification).toHaveBeenCalledWith(
        'kyc-1',
        'admin-1',
        'ID matching metadata profile mismatch',
      );
    });
  });
});
