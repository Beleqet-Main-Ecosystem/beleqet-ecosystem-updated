import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { UploadsService } from './uploads.service';

import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),

    PutObjectCommand: jest.fn().mockImplementation((params) => params),

    GetObjectCommand: jest.fn().mockImplementation((params) => params),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('UploadsService', () => {
  let service: UploadsService;

  let mockConfigService: any;

  let mockI18nService: any;

  let mockS3Send: jest.Mock;

  beforeEach(async () => {
    mockS3Send = jest.fn();

    (S3Client as jest.Mock).mockImplementation(() => ({
      send: mockS3Send,
    }));

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          R2_BUCKET_NAME: 'test-bucket',
          AWS_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: 'test-key',
          AWS_SECRET_ACCESS_KEY: 'test-secret',
          R2_PUBLIC_BASE_URL: 'https://storage.test.com',
        };

        return config[key] ?? defaultValue;
      }),
    };
    mockI18nService = {
      translate: jest.fn((key) => key),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,

        {
          provide: ConfigService,
          useValue: mockConfigService,
        },

        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateUploadUrl', () => {
    it('should generate signed upload URL', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue('https://signed-upload-url.com');

      const result = await service.generateUploadUrl('passport.jpg', 'image/jpeg', 'kyc');

      expect(result.uploadUrl).toBe('https://signed-upload-url.com');

      expect(result.key).toContain('kyc/');

      expect(result.publicUrl).toContain('https://storage.test.com');

      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('should throw when storage is not configured', async () => {
      const emptyConfig = {
        get: jest.fn().mockReturnValue(undefined),
      };

      const module = await Test.createTestingModule({
        providers: [
          UploadsService,

          {
            provide: ConfigService,
            useValue: emptyConfig,
          },

          {
            provide: I18nService,
            useValue: mockI18nService,
          },
        ],
      }).compile();

      const brokenService = module.get<UploadsService>(UploadsService);

      await expect(brokenService.generateUploadUrl('test.jpg', 'image/jpeg')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      mockS3Send.mockResolvedValue({});

      const file = {
        originalname: 'avatar.png',

        mimetype: 'image/png',

        buffer: Buffer.from('hello'),
      };

      const result = await service.uploadFile(file, 'profiles');

      expect(result.key).toContain('profiles/');

      expect(result.publicUrl).toContain('https://storage.test.com');

      expect(mockS3Send).toHaveBeenCalled();
    });

    it('should handle upload failure', async () => {
      mockS3Send.mockRejectedValue(new Error('S3 failed'));

      await expect(
        service.uploadFile({
          originalname: 'test.png',

          mimetype: 'image/png',

          buffer: Buffer.from('data'),
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('generateDownloadUrl', () => {
    it('should generate signed download url', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue('https://download-url.com');

      const result = await service.generateDownloadUrl('kyc/file.png');

      expect(result).toBe('https://download-url.com');

      expect(getSignedUrl).toHaveBeenCalled();
    });
  });

  describe('getFileBuffer', () => {
    it('should download file buffer', async () => {
      const stream = require('stream');

      const readable = new stream.Readable();

      readable.push(Buffer.from('file-data'));

      readable.push(null);

      mockS3Send.mockResolvedValue({
        Body: readable,
      });

      const result = await service.getFileBuffer('kyc/document.pdf');

      expect(result).toEqual(Buffer.from('file-data'));
    });

    it('should throw when object body is missing', async () => {
      mockS3Send.mockResolvedValue({
        Body: null,
      });

      await expect(service.getFileBuffer('missing-file')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
