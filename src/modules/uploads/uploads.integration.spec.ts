import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { PutObjectCommand } from '@aws-sdk/client-s3';
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

const mockI18nService = {
  translate: jest.fn((key: string) => key),
};

@Global()
@Module({
  providers: [
    { provide: ConfigService, useValue: mockConfigService },
    { provide: I18nService, useValue: mockI18nService },
  ],
  exports: [ConfigService, I18nService],
})
class MockGlobalDependenciesModule {}

describe('UploadsModule integration', () => {
  let moduleRef: TestingModule;
  let uploadsService: UploadsService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [MockGlobalDependenciesModule, UploadsModule],
    }).compile();

    uploadsService = moduleRef.get<UploadsService>(UploadsService);
    const s3Client = (uploadsService as unknown as { s3Client: { send: jest.Mock } }).s3Client;
    s3Client.send = jest.fn().mockResolvedValue({});
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('wires the uploads module and preserves multi-currency boundaries', async () => {
    const file = {
      originalname: 'invoice.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('invoice-data', 'utf-8'),
      size: 12,
    };

    const result = await uploadsService.uploadFile(file, 'invoices', 'en');
    const s3Client = (uploadsService as unknown as { s3Client: { send: jest.Mock } }).s3Client;
    const command = s3Client.send.mock.calls[0][0] as PutObjectCommand;

    expect(result.publicUrl).toMatch(/^https:\/\/cdn\.beleqet\.com\/invoices\/.+\.pdf$/);
    expect(command.input.ContentType).toBe('application/pdf');
    expect(result).not.toHaveProperty('amount');
    expect(result).not.toHaveProperty('currency');
    expect(result).not.toHaveProperty('exchangeRate');
  });

  it('connects to user theme preference state for theme-specific CDN assets', async () => {
    const file = {
      originalname: 'logo.svg',
      mimetype: 'image/svg+xml',
      buffer: Buffer.from('<svg>   <path d="M0 0" />   </svg>', 'utf-8'),
      size: 36,
    };

    const result = await uploadsService.uploadFile(file, 'theme-assets/icons', {
      language: 'en',
      userThemePreference: 'dark',
    });

    expect(result.publicUrl).toMatch(
      /^https:\/\/cdn\.beleqet\.com\/theme-assets\/icons\/dark\/.+\.svg$/,
    );
    expect(result.key).toContain('/dark/');
    expect(result).not.toHaveProperty('amount');
    expect(result).not.toHaveProperty('currency');
  });
});
