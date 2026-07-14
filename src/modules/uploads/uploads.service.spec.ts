import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { UploadsService } from './uploads.service';

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

const mockI18nService = {
  translate: jest.fn((key: string) => key),
};

describe('UploadsService', () => {
  let service: UploadsService;
  const mockedGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;
  const mockedSharp = sharp as jest.MockedFunction<typeof sharp>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);

    const s3Client = (service as unknown as { s3Client: { send: jest.Mock } }).s3Client;
    s3Client.send = jest.fn().mockResolvedValue({});
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('generates presigned URLs with CDN public URLs and cache headers', async () => {
    mockedGetSignedUrl.mockResolvedValue('https://signed.example.com/url');

    const result = await service.generatePresignedUrl('profile.png', 'image/png', 'profiles', 'en');

    expect(result.presignedUrl).toBe('https://signed.example.com/url');
    expect(result.publicUrl).toMatch(/^https:\/\/cdn\.beleqet\.com\/profiles\/.+\.png$/);
    expect(result.cacheControl).toBe('public, max-age=31536000, immutable');
    expect(result.message).toBe('messages.uploads.presignedUrlCreated');
  });

  it('uploads JavaScript with optimization and gzip compression', async () => {
    const repeatedCode = 'const value = 1 + 1;\n'.repeat(1_000);
    const file = {
      originalname: 'bundle.js',
      mimetype: 'application/javascript',
      buffer: Buffer.from(repeatedCode, 'utf-8'),
      size: Buffer.byteLength(repeatedCode),
    };

    const result = await service.uploadFile(file, 'static', 'en');
    const s3Client = (service as unknown as { s3Client: { send: jest.Mock } }).s3Client;
    const command = s3Client.send.mock.calls[0][0] as PutObjectCommand;

    expect(result.publicUrl).toMatch(/^https:\/\/cdn\.beleqet\.com\/static\/.+\.js$/);
    expect(result.optimized).toBe(true);
    expect(result.contentEncoding).toBe('gzip');
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.ContentType).toBe('application/javascript');
    expect(command.input.ContentEncoding).toBe('gzip');
    expect(command.input.CacheControl).toBe('public, max-age=31536000, immutable');
  });

  it('converts image uploads to WebP before storing them', async () => {
    const file = {
      originalname: 'portfolio.png',
      mimetype: 'image/png',
      buffer: Buffer.from('raw-image-bytes', 'utf-8'),
      size: 15,
    };

    const result = await service.uploadFile(file, 'portfolio', 'en');
    const s3Client = (service as unknown as { s3Client: { send: jest.Mock } }).s3Client;
    const command = s3Client.send.mock.calls[0][0] as PutObjectCommand;

    expect(mockedSharp).toHaveBeenCalledWith(file.buffer);
    expect(result.publicUrl).toMatch(/^https:\/\/cdn\.beleqet\.com\/portfolio\/.+\.webp$/);
    expect(result.contentType).toBe('image/webp');
    expect(result.optimized).toBe(true);
    expect(command.input.ContentType).toBe('image/webp');
    expect(command.input.Body).toEqual(Buffer.from('optimized-webp'));
  });

  it('preserves supported non-image static files without image conversion', async () => {
    const file = {
      originalname: 'terms.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('pdf-bytes', 'utf-8'),
      size: 9,
    };

    const result = await service.uploadFile(file, 'documents', 'en');
    const s3Client = (service as unknown as { s3Client: { send: jest.Mock } }).s3Client;
    const command = s3Client.send.mock.calls[0][0] as PutObjectCommand;

    expect(mockedSharp).not.toHaveBeenCalled();
    expect(result.publicUrl).toMatch(/^https:\/\/cdn\.beleqet\.com\/documents\/.+\.pdf$/);
    expect(result.contentType).toBe('application/pdf');
    expect(result.optimized).toBe(false);
    expect(command.input.Body).toEqual(file.buffer);
  });

  it('throws a clean server error when storage credentials are missing', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const values: Record<string, string> = {
                AWS_S3_BUCKET: 'test-bucket',
                AWS_REGION: 'us-east-1',
              };
              return values[key] ?? defaultValue;
            }),
          },
        },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();
    const unconfiguredService = module.get<UploadsService>(UploadsService);

    await expect(
      unconfiguredService.generatePresignedUrl('profile.png', 'image/png', 'profiles', 'en'),
    ).rejects.toThrow('Cloud storage not configured on server');
  });
});
