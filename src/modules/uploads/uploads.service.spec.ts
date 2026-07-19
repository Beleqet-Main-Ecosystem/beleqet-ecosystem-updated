import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StoredFile } from '@prisma/client';
import sharp from 'sharp';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { MulterFile } from './interfaces/multer-file.interface';
import { UploadsService } from './uploads.service';
import { MAX_UPLOAD_FILE_SIZE_BYTES } from './uploads.constants';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('optimized-webp')),
  })),
}));

describe('UploadsService', () => {
  let service: UploadsService;
  const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;
  const mockedSharp = sharp as jest.MockedFunction<typeof sharp>;

  const mockPrismaService = {
    storedFile: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        AWS_S3_BUCKET: 'test-bucket',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        CDN_BASE_URL: 'https://cdn.beleqet.com',
        CDN_CACHE_CONTROL: 'public, max-age=31536000, immutable',
      };
      return values[key] ?? defaultValue;
    }),
  };

  const mockStoredFile = (overrides: Partial<StoredFile> = {}): StoredFile =>
    ({
      id: 'file-id-123',
      key: 'images/file.webp',
      filename: 'avatar.png',
      mimeType: 'image/webp',
      size: 100,
      uploadedById: 'user-123',
      hasConsentedToProcessing: true,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    }) as StoredFile;

  const mockFile = (mimeType: string, size: number, name = 'test.png'): MulterFile => ({
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype: mimeType,
    buffer: Buffer.from('mock file buffer content'),
    size,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.storedFile.create.mockResolvedValue(mockStoredFile());
    mockedGetSignedUrl.mockResolvedValue('https://signed.example.com/url');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
    const s3Client = (service as unknown as { s3Client: { send: jest.Mock } }).s3Client;
    s3Client.send = jest.fn().mockResolvedValue({});
  });

  describe('generatePresignedUrl', () => {
    it('uses MIME-derived extensions and stores Prisma metadata for current user', async () => {
      const result = await service.generatePresignedUrl(
        '../profile.exe',
        'image/png',
        'profiles',
        'user-123',
        1024,
      );

      expect(result.presignedUrl).toBe('https://signed.example.com/url');
      expect(result.publicUrl).toMatch(/^https:\/\/cdn\.beleqet\.com\/profiles\/.+\.png$/);
      expect(mockPrismaService.storedFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filename: 'profile.exe',
          mimeType: 'image/png',
          size: 1024,
          uploadedById: 'user-123',
        }),
      });
    });

    it('rejects unsafe storage folder prefixes', async () => {
      await expect(
        service.generatePresignedUrl('profile.png', 'image/png', '../../etc', 'user-123', 100),
      ).rejects.toThrow('Invalid upload folder');
    });
  });

  describe('uploadFile', () => {
    it('rejects uploads when GDPR consent is not granted', async () => {
      const file = mockFile('image/png', 100);
      await expect(service.uploadFile(file, false)).rejects.toThrow(
        'GDPR data processing consent is mandatory to upload files.',
      );
    });

    it('rejects unsupported MIME types with the strict allowlist', async () => {
      const file = mockFile('text/html', 100, 'payload.html');
      await expect(service.uploadFile(file, true)).rejects.toThrow(
        'Invalid file type. Executables and HTML files are not allowed.',
      );
    });

    it('rejects uploads above the maximum file size', async () => {
      const file = mockFile('application/pdf', MAX_UPLOAD_FILE_SIZE_BYTES + 1, 'large.pdf');
      await expect(service.uploadFile(file, true)).rejects.toThrow(
        `File size must not exceed ${MAX_UPLOAD_FILE_SIZE_BYTES} bytes.`,
      );
    });

    it('converts image uploads to WebP before S3 storage and Prisma tracking', async () => {
      const file = mockFile('image/png', 500, 'avatar.png');
      mockPrismaService.storedFile.create.mockResolvedValue(
        mockStoredFile({ key: 'images/generated.webp', mimeType: 'image/webp', size: 14 }),
      );

      const result = await service.uploadFile(file, true, 'user-123');
      const s3Client = (service as unknown as { s3Client: { send: jest.Mock } }).s3Client;
      const command = s3Client.send.mock.calls[0][0] as PutObjectCommand;

      expect(mockedSharp).toHaveBeenCalledWith(file.buffer);
      expect(command.input.ContentType).toBe('image/webp');
      expect(command.input.Body).toEqual(Buffer.from('optimized-webp'));
      expect(result.publicUrl).toMatch(/^https:\/\/cdn\.beleqet\.com\/images\/.+\.webp$/);
      expect(result.optimized).toBe(true);
      expect(mockPrismaService.storedFile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          filename: 'avatar.png',
          mimeType: 'image/webp',
          size: Buffer.from('optimized-webp').length,
          uploadedById: 'user-123',
        }),
      });
    });

    it('rejects corrupted image payloads with a bad request error', async () => {
      mockedSharp.mockReturnValueOnce({
        webp: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockRejectedValue(new Error('unsupported image')),
      } as unknown as ReturnType<typeof sharp>);

      const file = mockFile('image/png', 100, 'broken.png');

      await expect(service.uploadFile(file, true, 'user-123')).rejects.toThrow(
        'Uploaded image is invalid or corrupted',
      );
    });

    it('stores supported non-image files as-is and ignores spoofed filename paths', async () => {
      const file = mockFile('application/pdf', 500, '../terms.exe');
      mockPrismaService.storedFile.create.mockResolvedValue(
        mockStoredFile({
          key: 'documents/generated.pdf',
          filename: 'terms.exe',
          mimeType: 'application/pdf',
        }),
      );

      const result = await service.uploadFile(file, true, 'user-123');
      const s3Client = (service as unknown as { s3Client: { send: jest.Mock } }).s3Client;
      const command = s3Client.send.mock.calls[0][0] as PutObjectCommand;

      expect(mockedSharp).not.toHaveBeenCalled();
      expect(command.input.ContentType).toBe('application/pdf');
      expect(command.input.Body).toEqual(file.buffer);
      expect(result.publicUrl).toMatch(/^https:\/\/cdn\.beleqet\.com\/documents\/.+\.pdf$/);
      expect(result.optimized).toBe(false);
    });
  });

  describe('getPresignedReadUrl', () => {
    it('rejects unsafe file keys before storage lookup', async () => {
      await expect(service.getPresignedReadUrl('../secret.txt')).rejects.toThrow(
        'Invalid file key pathway.',
      );
      expect(mockPrismaService.storedFile.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if file record is not found in database', async () => {
      mockPrismaService.storedFile.findUnique.mockResolvedValue(null);
      await expect(
        service.getPresignedReadUrl('images/123e4567-e89b-12d3-a456-426614174000.webp'),
      ).rejects.toThrow(
        new NotFoundException('The requested file does not exist or has been deleted.'),
      );
    });
  });

  describe('softDeleteFile', () => {
    it('throws ForbiddenException if user is not the owner', async () => {
      mockPrismaService.storedFile.findUnique.mockResolvedValue(
        mockStoredFile({
          key: 'images/123e4567-e89b-12d3-a456-426614174000.webp',
          uploadedById: 'other-user',
        }),
      );

      await expect(
        service.softDeleteFile('images/123e4567-e89b-12d3-a456-426614174000.webp', 'user-123'),
      ).rejects.toThrow(new ForbiddenException('You do not have permission to delete this file.'));
    });

    it('updates the database record and marks file as deleted with masked name', async () => {
      const key = 'images/123e4567-e89b-12d3-a456-426614174000.webp';
      mockPrismaService.storedFile.findUnique.mockResolvedValue(
        mockStoredFile({ key, uploadedById: 'user-123' }),
      );
      mockPrismaService.storedFile.update.mockResolvedValue(
        mockStoredFile({ key, isDeleted: true, filename: 'DELETED_GDPR_COMPLIANCE_MASKED' }),
      );

      const result = await service.softDeleteFile(key, 'user-123');

      expect(result.isDeleted).toBe(true);
      expect(result.filename).toBe('DELETED_GDPR_COMPLIANCE_MASKED');
      expect(mockPrismaService.storedFile.update).toHaveBeenCalledWith({
        where: { key },
        data: expect.objectContaining({
          isDeleted: true,
          filename: 'DELETED_GDPR_COMPLIANCE_MASKED',
        }),
      });
    });
  });

  describe('getMyFiles', () => {
    it('queries prisma findMany and filters by userId and non-deleted files', async () => {
      const mockFilesList = [
        mockStoredFile({ key: 'images/file1.webp', uploadedById: 'user-123' }),
        mockStoredFile({ key: 'documents/file2.pdf', uploadedById: 'user-123' }),
      ];
      mockPrismaService.storedFile.findMany.mockResolvedValue(mockFilesList);

      const result = await service.getMyFiles('user-123');

      expect(result).toEqual(mockFilesList);
      expect(mockPrismaService.storedFile.findMany).toHaveBeenCalledWith({
        where: { uploadedById: 'user-123', isDeleted: false },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});