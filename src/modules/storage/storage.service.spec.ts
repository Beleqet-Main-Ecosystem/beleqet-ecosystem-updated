import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StoredFile } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

describe('StorageService', () => {
  let service: StorageService;
  let prisma: PrismaService;

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
      if (key === 'AWS_S3_BUCKET') return 'test-bucket';
      if (key === 'AWS_REGION') return 'us-east-1';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const mockFile = (mimeType: string, size: number, name = 'test.png'): Express.Multer.File => ({
      fieldname: 'file',
      originalname: name,
      encoding: '7bit',
      mimetype: mimeType,
      buffer: Buffer.from('mock file buffer content'),
      size: size,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    });

    it('should throw BadRequestException if GDPR consent is not granted', async () => {
      const file = mockFile('image/png', 100);
      await expect(service.uploadFile(file, false)).rejects.toThrow(
        new BadRequestException('GDPR data processing consent is mandatory to upload files.'),
      );
    });

    it('should throw BadRequestException for unsupported mime types', async () => {
      const file = mockFile('application/zip', 100);
      await expect(service.uploadFile(file, true)).rejects.toThrow(
        new BadRequestException('Unsupported file type: application/zip'),
      );
    });

    it('should throw BadRequestException if image exceeds 5MB limit', async () => {
      const file = mockFile('image/jpeg', 6 * 1024 * 1024); // 6MB
      await expect(service.uploadFile(file, true)).rejects.toThrow(
        new BadRequestException('Image size exceeds the maximum limit of 5MB.'),
      );
    });

    it('should throw BadRequestException if document exceeds 10MB limit', async () => {
      const file = mockFile('application/pdf', 11 * 1024 * 1024); // 11MB
      await expect(service.uploadFile(file, true)).rejects.toThrow(
        new BadRequestException('Document size exceeds the maximum limit of 10MB.'),
      );
    });

    it('should successfully store file and save metadata in database', async () => {
      const file = mockFile('image/png', 500, 'avatar.png');
      const expectedRecord: Partial<StoredFile> = {
        id: 'uuid-1',
        key: 'images/uuid-random.png',
        filename: 'avatar.png',
        mimeType: 'image/png',
        size: 500,
        hasConsentedToProcessing: true,
        isDeleted: false,
        uploadedById: 'user-123',
      };

      mockPrismaService.storedFile.create.mockResolvedValue(expectedRecord as StoredFile);

      const result = await service.uploadFile(file, true, 'user-123');

      expect(result).toBeDefined();
      expect(result.filename).toBe('avatar.png');
      expect(result.uploadedById).toBe('user-123');
      expect(mockPrismaService.storedFile.create).toHaveBeenCalled();

      // Clean up temp file created during local fallback testing
      if (service.isLocalFallbackActive()) {
        const localPath = path.join(service.getLocalStoreDir(), result.key);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
    });
  });

  describe('getPresignedReadUrl', () => {
    it('should throw NotFoundException if file record is not found in database', async () => {
      mockPrismaService.storedFile.findUnique.mockResolvedValue(null);
      await expect(service.getPresignedReadUrl('nonexistent-key')).rejects.toThrow(
        new NotFoundException('The requested file does not exist or has been deleted.'),
      );
    });

    it('should throw NotFoundException if file is marked as soft-deleted', async () => {
      const mockRecord: Partial<StoredFile> = {
        key: 'images/deleted.png',
        isDeleted: true,
      };
      mockPrismaService.storedFile.findUnique.mockResolvedValue(mockRecord as StoredFile);

      await expect(service.getPresignedReadUrl('images/deleted.png')).rejects.toThrow(
        new NotFoundException('The requested file does not exist or has been deleted.'),
      );
    });

    it('should return a secure download URL if file exists and is active', async () => {
      const mockRecord: Partial<StoredFile> = {
        key: 'images/file.png',
        isDeleted: false,
      };
      mockPrismaService.storedFile.findUnique.mockResolvedValue(mockRecord as StoredFile);

      const result = await service.getPresignedReadUrl('images/file.png');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('softDeleteFile', () => {
    it('should throw NotFoundException if file record doesn\'t exist', async () => {
      mockPrismaService.storedFile.findUnique.mockResolvedValue(null);
      await expect(service.softDeleteFile('images/missing.png')).rejects.toThrow(
        new NotFoundException('The file does not exist or has already been deleted.'),
      );
    });

    it('should update the database record and mark as deleted with masked name', async () => {
      const mockRecord: Partial<StoredFile> = {
        key: 'images/active.png',
        filename: 'active.png',
        isDeleted: false,
      };
      const mockUpdatedRecord: Partial<StoredFile> = {
        key: 'images/active.png',
        filename: 'DELETED_GDPR_COMPLIANCE_MASKED',
        isDeleted: true,
      };

      mockPrismaService.storedFile.findUnique.mockResolvedValue(mockRecord as StoredFile);
      mockPrismaService.storedFile.update.mockResolvedValue(mockUpdatedRecord as StoredFile);

      const result = await service.softDeleteFile('images/active.png');
      expect(result.isDeleted).toBe(true);
      expect(result.filename).toBe('DELETED_GDPR_COMPLIANCE_MASKED');
      expect(mockPrismaService.storedFile.update).toHaveBeenCalledWith({
        where: { key: 'images/active.png' },
        data: expect.objectContaining({
          isDeleted: true,
          filename: 'DELETED_GDPR_COMPLIANCE_MASKED',
        }),
      });
    });
  });

  describe('getMyFiles', () => {
    it('should query prisma findMany and filter by userId and non-deleted files', async () => {
      const mockFilesList = [
        { key: 'images/file1.png', uploadedById: 'user-123', isDeleted: false },
        { key: 'documents/file2.pdf', uploadedById: 'user-123', isDeleted: false },
      ];
      mockPrismaService.storedFile.findMany = jest.fn().mockResolvedValue(mockFilesList);

      const result = await service.getMyFiles('user-123');

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockFilesList);
      expect(mockPrismaService.storedFile.findMany).toHaveBeenCalledWith({
        where: {
          uploadedById: 'user-123',
          isDeleted: false,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});

