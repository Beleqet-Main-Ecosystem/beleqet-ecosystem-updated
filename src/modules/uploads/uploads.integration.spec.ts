import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsModule } from './uploads.module';
import { UploadsService } from './uploads.service';

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

const mockPrismaService = {
  storedFile: {
    create: jest.fn(({ data }) =>
      Promise.resolve({
        id: 'stored-file-id',
        ...data,
        isDeleted: false,
        deletedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

@Module({
  providers: [
    { provide: ConfigService, useValue: mockConfigService },
    { provide: PrismaService, useValue: mockPrismaService },
  ],
  exports: [ConfigService, PrismaService],
})
class MockGlobalDependenciesModule {}

describe('UploadsModule integration', () => {
  let moduleRef: TestingModule;
  let uploadsService: UploadsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    moduleRef = await Test.createTestingModule({
      imports: [UploadsModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    uploadsService = moduleRef.get<UploadsService>(UploadsService);
    const s3Client = (uploadsService as unknown as { s3Client: { send: jest.Mock } }).s3Client;
    s3Client.send = jest.fn().mockResolvedValue({});
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('wires S3/CDN upload with Prisma StoredFile tracking', async () => {
    const file = {
      originalname: '../invoice.exe',
      mimetype: 'application/pdf',
      buffer: Buffer.from('invoice-data', 'utf-8'),
      size: 12,
    };

    const result = await uploadsService.uploadFile(file, 'invoices', 'user-123');
    const s3Client = (uploadsService as unknown as { s3Client: { send: jest.Mock } }).s3Client;
    const command = s3Client.send.mock.calls[0][0] as PutObjectCommand;

    expect(result.publicUrl).toMatch(/^https:\/\/cdn\.beleqet\.com\/invoices\/.+\.pdf$/);
    expect(command.input.ContentType).toBe('application/pdf');
    expect(command.input.Key).toMatch(/^invoices\/.+\.pdf$/);
    expect(mockPrismaService.storedFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        filename: 'invoice.exe',
        mimeType: 'application/pdf',
        uploadedById: 'user-123',
      }),
    });
    expect(result).not.toHaveProperty('amount');
    expect(result).not.toHaveProperty('currency');
    expect(result).not.toHaveProperty('exchangeRate');
  });

  it('rejects path traversal folders before upload side effects', async () => {
    const file = {
      originalname: 'invoice.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('invoice-data', 'utf-8'),
      size: 12,
    };

    await expect(uploadsService.uploadFile(file, '../../etc', 'user-123')).rejects.toThrow(
      'Invalid upload folder',
    );
  });
});
