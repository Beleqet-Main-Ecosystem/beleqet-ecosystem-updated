import { Test, TestingModule } from '@nestjs/testing';
import { StorageController, UploadFileDto } from './storage.controller';
import { StorageService } from './storage.service';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { BadRequestException } from '@nestjs/common';
import { Response } from 'express';

describe('StorageController', () => {
  let controller: StorageController;
  let service: StorageService;

  const mockStorageService = {
    uploadFile: jest.fn(),
    getPresignedReadUrl: jest.fn(),
    softDeleteFile: jest.fn(),
    isLocalFallbackActive: jest.fn(),
    getLocalStoreDir: jest.fn(),
    getMyFiles: jest.fn(),
  };

  const mockUserPayload: CurrentUserPayload = {
    userId: 'user-id-123',
    email: 'test@example.com',
    role: 'JOB_SEEKER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [{ provide: StorageService, useValue: mockStorageService }],
    }).compile();

    controller = module.get<StorageController>(StorageController);
    service = module.get<StorageService>(StorageService);
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const mockFile = (): Express.Multer.File => ({
      fieldname: 'file',
      originalname: 'resume.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: Buffer.from('pdf buffer'),
      size: 200,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    });

    it('should throw BadRequestException if no file is provided', async () => {
      const dto: UploadFileDto = { hasConsentedToProcessing: 'true' };
      await expect(
        controller.uploadFile(null as any, dto, mockUserPayload),
      ).rejects.toThrow(new BadRequestException('No file uploaded.'));
    });

    it('should call service.uploadFile with parsed consent flag and return result', async () => {
      const file = mockFile();
      const dto: UploadFileDto = { hasConsentedToProcessing: 'true' };
      const expectedResult = { id: 'file-id', key: 'documents/uuid.pdf' };
      
      mockStorageService.uploadFile.mockResolvedValue(expectedResult);

      const result = await controller.uploadFile(file, dto, mockUserPayload);

      expect(result).toEqual(expectedResult);
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(file, true, 'user-id-123');
    });

    it('should correctly handle negative representation of consent', async () => {
      const file = mockFile();
      const dto: UploadFileDto = { hasConsentedToProcessing: 'false' };
      const expectedResult = { id: 'file-id', key: 'documents/uuid.pdf' };

      mockStorageService.uploadFile.mockResolvedValue(expectedResult);

      const result = await controller.uploadFile(file, dto, mockUserPayload);

      expect(result).toEqual(expectedResult);
      expect(mockStorageService.uploadFile).toHaveBeenCalledWith(file, false, 'user-id-123');
    });
  });

  describe('getPresignedReadUrl', () => {
    it('should query service for presigned url using key paths', async () => {
      const expectedUrl = 'https://s3.amazonaws.com/test-bucket/images/avatar.jpg?signature=mock';
      mockStorageService.getPresignedReadUrl.mockResolvedValue(expectedUrl);

      const result = await controller.getPresignedReadUrl('images', 'avatar.jpg');

      expect(result).toEqual({ url: expectedUrl });
      expect(mockStorageService.getPresignedReadUrl).toHaveBeenCalledWith('images/avatar.jpg');
    });
  });

  describe('softDeleteFile', () => {
    it('should trigger service soft-deletion and return result', async () => {
      const expectedResult = { key: 'images/avatar.jpg', isDeleted: true };
      mockStorageService.softDeleteFile.mockResolvedValue(expectedResult);

      const result = await controller.softDeleteFile('images', 'avatar.jpg');

      expect(result).toEqual(expectedResult);
      expect(mockStorageService.softDeleteFile).toHaveBeenCalledWith('images/avatar.jpg');
    });
  });

  describe('serveLocalFile', () => {
    it('should throw BadRequestException if local fallback is disabled', async () => {
      mockStorageService.isLocalFallbackActive.mockReturnValue(false);
      const mockRes = {} as Response;

      await expect(
        controller.serveLocalFile('images', 'test.jpg', mockRes),
      ).rejects.toThrow(
        new BadRequestException('Local file serving fallback is not active in this environment.'),
      );
    });

    it('should throw BadRequestException if directory traversal path is supplied', async () => {
      mockStorageService.isLocalFallbackActive.mockReturnValue(true);
      const mockRes = {} as Response;

      await expect(
        controller.serveLocalFile('images', '../../etc/passwd', mockRes),
      ).rejects.toThrow(new BadRequestException('Invalid file key pathway.'));
    });
  });

  describe('getMyFiles', () => {
    it('should call service getMyFiles with active user ID and return list', async () => {
      const mockFilesList = [
        { key: 'images/file1.png', uploadedById: 'user-id-123', isDeleted: false },
      ];
      mockStorageService.uploadFile.mockResolvedValue(mockFilesList); // reuse mock or define custom
      jest.spyOn(service, 'getMyFiles').mockResolvedValue(mockFilesList as any);

      const result = await controller.getMyFiles(mockUserPayload);

      expect(result).toEqual(mockFilesList);
      expect(service.getMyFiles).toHaveBeenCalledWith('user-id-123');
    });
  });
});

