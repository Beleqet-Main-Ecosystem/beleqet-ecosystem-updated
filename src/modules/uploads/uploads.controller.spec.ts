import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  PresignedUrlDto,
  UPLOAD_FILE_INTERCEPTOR_OPTIONS,
  UploadFileDto,
  UploadsController,
} from './uploads.controller';
import { MulterFile } from './interfaces/multer-file.interface';
import { UploadsService } from './uploads.service';

const mockUploadsService = {
  generatePresignedUrl: jest.fn(),
  uploadFile: jest.fn(),
  getPresignedReadUrl: jest.fn(),
  softDeleteFile: jest.fn(),
  isLocalFallbackActive: jest.fn(),
  getLocalStoreDir: jest.fn(),
  getMyFiles: jest.fn(),
  resolveLocalFilePath: jest.fn(),
};

const mockUserPayload = {
  userId: 'user-id-123',
  email: 'user@example.com',
  role: 'freelancer',
};

const mockFile = (): MulterFile => ({
  fieldname: 'file',
  originalname: 'resume.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  buffer: Buffer.from('pdf buffer'),
  size: 200,
});

describe('UploadsController', () => {
  let controller: UploadsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: UploadsService, useValue: mockUploadsService }],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
  });

  describe('getPresignedUrl', () => {
    it('uses CurrentUser and passes validated upload metadata to service', async () => {
      const expectedResult = {
        key: 'profiles/file.webp',
        publicUrl: 'https://cdn.example.com/file.webp',
      };
      mockUploadsService.generatePresignedUrl.mockResolvedValue(expectedResult);

      const result = await controller.getPresignedUrl(
        {
          filename: 'avatar.png',
          contentType: 'image/png',
          folder: 'profiles',
          fileSize: 1024,
        },
        mockUserPayload,
      );

      expect(result).toEqual(expectedResult);
      expect(mockUploadsService.generatePresignedUrl).toHaveBeenCalledWith(
        'avatar.png',
        'image/png',
        'profiles',
        'user-id-123',
        1024,
      );
    });

    it('preserves the strict presigned URL MIME allowlist', async () => {
      const dto = plainToInstance(PresignedUrlDto, {
        filename: 'index.html',
        contentType: 'text/html',
        fileSize: 1024,
      });

      const errors = await validate(dto);

      expect(ALLOWED_MIME_TYPES).toContain('image/png');
      expect(ALLOWED_MIME_TYPES).not.toContain('text/html');
      expect(errors.some((error) => error.property === 'contentType')).toBe(true);
    });

    it('rejects presigned URL requests above the maximum file size', async () => {
      const dto = plainToInstance(PresignedUrlDto, {
        filename: 'portfolio.pdf',
        contentType: 'application/pdf',
        fileSize: MAX_UPLOAD_FILE_SIZE_BYTES + 1,
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'fileSize')).toBe(true);
    });
  });

  describe('uploadFile', () => {
    it('throws BadRequestException if no file is provided', async () => {
      const dto: UploadFileDto = { hasConsentedToProcessing: 'true' };

      await expect(controller.uploadFile(undefined, dto, mockUserPayload)).rejects.toThrow(
        new BadRequestException('No file uploaded.'),
      );
    });

    it('calls service.uploadFile with parsed consent flag and current user id', async () => {
      const file = mockFile();
      const expectedResult = { id: 'file-id-123', filename: 'resume.pdf' };
      mockUploadsService.uploadFile.mockResolvedValue(expectedResult);

      const result = await controller.uploadFile(
        file,
        { hasConsentedToProcessing: 'true' },
        mockUserPayload,
      );

      expect(result).toEqual(expectedResult);
      expect(mockUploadsService.uploadFile).toHaveBeenCalledWith(file, true, 'user-id-123');
    });

    it('configures multipart MIME filtering and size limits before service layer', () => {
      expect(UPLOAD_FILE_INTERCEPTOR_OPTIONS.limits.fileSize).toBe(MAX_UPLOAD_FILE_SIZE_BYTES);

      const callback = jest.fn();
      UPLOAD_FILE_INTERCEPTOR_OPTIONS.fileFilter({}, { mimetype: 'text/html' }, callback);

      expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
      expect(mockUploadsService.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('getPresignedReadUrl', () => {
    it('queries uploads service with folder/filename key', async () => {
      mockUploadsService.getPresignedReadUrl.mockResolvedValue('https://s3.example.com/read-url');

      const result = await controller.getPresignedReadUrl('images', 'avatar.webp');

      expect(result).toEqual({ url: 'https://s3.example.com/read-url' });
      expect(mockUploadsService.getPresignedReadUrl).toHaveBeenCalledWith('images/avatar.webp');
    });
  });

  describe('softDeleteFile', () => {
    it('triggers uploads service soft delete for current user', async () => {
      const expectedResult = { key: 'images/avatar.webp', isDeleted: true };
      mockUploadsService.softDeleteFile.mockResolvedValue(expectedResult);

      const result = await controller.softDeleteFile('images', 'avatar.webp', mockUserPayload);

      expect(result).toEqual(expectedResult);
      expect(mockUploadsService.softDeleteFile).toHaveBeenCalledWith(
        'images/avatar.webp',
        'user-id-123',
      );
    });
  });

  describe('getMyFiles', () => {
    it('lists active uploads for user', async () => {
      const mockFilesList = [
        { key: 'images/file1.webp', uploadedById: 'user-id-123', isDeleted: false },
      ];
      mockUploadsService.getMyFiles.mockResolvedValue(mockFilesList);

      const result = await controller.getMyFiles(mockUserPayload);

      expect(result).toEqual(mockFilesList);
      expect(mockUploadsService.getMyFiles).toHaveBeenCalledWith('user-id-123');
    });
  });
});