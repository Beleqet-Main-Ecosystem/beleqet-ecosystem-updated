import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  PresignedUrlDto,
  UPLOAD_FILE_INTERCEPTOR_OPTIONS,
  UploadsController,
} from './uploads.controller';
import { UploadsService } from './uploads.service';

const mockUploadsService = {
  generatePresignedUrl: jest.fn().mockResolvedValue({
    presignedUrl: 'https://s3.example.com/presigned',
    publicUrl: 'https://cdn.example.com/public',
    key: 'misc/test-file.pdf',
  }),
  uploadFile: jest.fn().mockResolvedValue({
    publicUrl: 'https://cdn.example.com/resumes/file.webp',
    key: 'resumes/file.webp',
    optimized: true,
  }),
};

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

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('uses default folder, parsed language, and user theme preference', async () => {
    await controller.getPresignedUrl(
      {
        filename: 'avatar.png',
        contentType: 'image/png',
        fileSize: 1024,
      },
      'en-US,en;q=0.9',
      'dark',
    );

    expect(mockUploadsService.generatePresignedUrl).toHaveBeenCalledWith(
      'avatar.png',
      'image/png',
      'misc',
      { language: 'en-US', userThemePreference: 'dark' },
    );
  });

  it('rejects direct uploads when the multipart file field is missing', async () => {
    await expect(controller.uploadFile(undefined, 'en-US,en;q=0.9', 'dark')).rejects.toThrow(
      'Uploaded file is required',
    );
    expect(mockUploadsService.uploadFile).not.toHaveBeenCalled();
  });

  it('preserves the strict presigned URL MIME allowlist', async () => {
    const dto = new PresignedUrlDto();
    dto.filename = 'index.html';
    dto.contentType = 'text/html';
    dto.fileSize = 1024;

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

  it('configures multipart upload filtering before the service layer', () => {
    expect(UPLOAD_FILE_INTERCEPTOR_OPTIONS.limits.fileSize).toBe(MAX_UPLOAD_FILE_SIZE_BYTES);

    const callback = jest.fn();
    UPLOAD_FILE_INTERCEPTOR_OPTIONS.fileFilter({}, { mimetype: 'text/html' }, callback);

    expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
    expect(mockUploadsService.uploadFile).not.toHaveBeenCalled();
  });
});
