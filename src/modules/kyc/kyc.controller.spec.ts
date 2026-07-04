import { Test, TestingModule } from '@nestjs/testing';
import { KycController, SubmitKycDto, RejectKycDto, KycUploadFile } from './kyc.controller';
import { KycService } from './kyc.service';
import { KycDocumentType, KycStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

const mockKycService = {
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

  describe('submitKyc', () => {
    const mockUser = { userId: 'user-1', email: 'test@beleqet.com', role: 'FREELANCER' };
    const mockFile = { buffer: Buffer.from('test'), originalname: 'test.jpg', mimetype: 'image/jpeg' } as KycUploadFile;

    it('should throw BadRequestException if files are missing', async () => {
      const dto: SubmitKycDto = { documentType: KycDocumentType.PASSPORT };
      
      await expect(
        controller.submitKyc(
          { document: undefined, faceScan: undefined },
          mockUser,
          dto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should submit verification details when valid files are uploaded', async () => {
      const dto: SubmitKycDto = { documentType: KycDocumentType.PASSPORT };
      mockKycService.submitVerification.mockResolvedValue({ status: KycStatus.APPROVED });

      const files = {
        document: [mockFile],
        faceScan: [mockFile],
      };

      const result = await controller.submitKyc(files, mockUser, dto);

      expect(result.status).toBe(KycStatus.APPROVED);
      expect(mockKycService.submitVerification).toHaveBeenCalledWith(
        'user-1',
        KycDocumentType.PASSPORT,
        mockFile,
        mockFile,
      );
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
      const dto: RejectKycDto = { reason: 'ID mismatch' };
      mockKycService.rejectVerification.mockResolvedValue({ status: KycStatus.REJECTED });

      const result = await controller.reject('kyc-1', mockAdmin, dto);

      expect(result.status).toBe(KycStatus.REJECTED);
      expect(mockKycService.rejectVerification).toHaveBeenCalledWith('kyc-1', 'admin-1', 'ID mismatch');
    });
  });
});
