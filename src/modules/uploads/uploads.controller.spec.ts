import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController, UploadFileDto } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { BadRequestException } from '@nestjs/common';
import { MulterFile } from './interfaces/multer-file.interface';

const mockUploadsService = {
  generatePresignedUrl: jest.fn(),
  uploadFile: jest.fn(),
  getPresignedReadUrl: jest.fn(),
  softDeleteFile: jest.fn(),
  isLocalFallbackActive: jest.fn(),
  getLocalStoreDir: jest.fn(),
  getMyFiles: jest.fn(),
};

const mockUserPayload = {
  userId: 'user-id-123',
  email: 'user@example.com',
  role: 'freelancer',
};

describe('UploadsController', () => {
  let controller: UploadsController;
  let service: UploadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: UploadsService, useValue: mockUploadsService }],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
    service = module.get<UploadsService>(UploadsService);
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const mockFile = (): MulterFile => ({
      fieldname: 'file',
      originalname: 'resume.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('pdf buffer'),
      size: 200,
    });

    it('should throw BadRequestException if no file is provided', async () => {
      const dto: UploadFileDto = { hasConsentedToProcessing: 'true' };
      await expect(
        controller.uploadFile(null as any, dto, mockUserPayload),
      ).rejects.toThrow(new BadRequestException('No file uploaded.'));
    });

    it('should call service.uploadFile with parsed consent flag and return result', async () => {
      const file = mockFile();
      const expectedResult = { id: 'file-id-123', filename: 'resume.pdf' };
      mockUploadsService.uploadFile.mockResolvedValue(expectedResult);

      const dto: UploadFileDto = { hasConsentedToProcessing: 'true' };
      const result = await controller.uploadFile(file, dto, mockUserPayload);

      expect(result).toEqual(expectedResult);
      expect(mockUploadsService.uploadFile).toHaveBeenCalledWith(file, true, 'user-id-123');
    });

    it('should handle consent flag as false correctly', async () => {
      const file = mockFile();
      const expectedResult = { id: 'file-id-123', filename: 'resume.pdf' };
      mockUploadsService.uploadFile.mockResolvedValue(expectedResult);

      const dto: UploadFileDto = { hasConsentedToProcessing: 'false' };
      await controller.uploadFile(file, dto, mockUserPayload);

      expect(mockUploadsService.uploadFile).toHaveBeenCalledWith(file, false, 'user-id-123');
    });
  });

  describe('getPresignedReadUrl', () => {
    it('should query uploads service with folder/filename key', async () => {
      const expectedUrl = 'https://s3.example.com/read-presigned-url';
      mockUploadsService.getPresignedReadUrl.mockResolvedValue(expectedUrl);

      const result = await controller.getPresignedReadUrl('images', 'avatar.jpg');

      expect(result).toEqual({ url: expectedUrl });
      expect(mockUploadsService.getPresignedReadUrl).toHaveBeenCalledWith('images/avatar.jpg');
    });
  });

  describe('softDeleteFile', () => {
    it('should trigger uploads service soft delete', async () => {
      const expectedResult = { key: 'images/avatar.jpg', isDeleted: true };
      mockUploadsService.softDeleteFile.mockResolvedValue(expectedResult);

      const result = await controller.softDeleteFile('images', 'avatar.jpg', mockUserPayload);

      expect(result).toEqual(expectedResult);
      expect(mockUploadsService.softDeleteFile).toHaveBeenCalledWith('images/avatar.jpg', 'user-id-123');
    });
  });

  describe('serveLocalFile', () => {
    it('should throw BadRequestException if local fallback is not active', async () => {
      mockUploadsService.isLocalFallbackActive.mockReturnValue(false);
      const mockRes = {};

      await expect(
        controller.serveLocalFile('images', 'avatar.jpg', mockRes as any),
      ).rejects.toThrow(new BadRequestException('Local file serving fallback is not active in this environment.'));
    });
  });

  describe('getMyFiles', () => {
    it('should list active uploads for user', async () => {
      const mockFilesList = [
        { key: 'images/file1.png', uploadedById: 'user-id-123', isDeleted: false },
      ];
      mockUploadsService.getMyFiles.mockResolvedValue(mockFilesList);

      const result = await controller.getMyFiles(mockUserPayload);

      expect(result).toEqual(mockFilesList);
      expect(mockUploadsService.getMyFiles).toHaveBeenCalledWith('user-id-123');
    });
  });
});
