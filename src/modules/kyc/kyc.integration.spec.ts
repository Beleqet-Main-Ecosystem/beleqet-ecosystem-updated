import { Test, TestingModule } from '@nestjs/testing';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { MockKycProvider } from './providers/mock-kyc-provider.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycDocumentType, KycStatus } from '@prisma/client';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

describe('KYC Module Component Integration', () => {
  let controller: KycController;
  let mockKycProvider: MockKycProvider;
  let prismaMock: any;
  let uploadsMock: any;

  // Mock application layer metadata payloads matching your auth architecture
  const mockUser: CurrentUserPayload = {
    userId: 'usr-dev-123',
    email: 'freelancer@network.et',
    role: 'FREELANCER',
  };

  beforeEach(async () => {
    // Intercept database state to protect pipeline isolation during integration testing
    prismaMock = {
      kycVerification: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      user: { update: jest.fn() },
      eventLog: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };

    // Intercept S3 actions to simulate rapid cloud object stream responses
    uploadsMock = {
      getFileBuffer: jest.fn().mockImplementation((key: string) => {
        // Return a tiny buffer to trigger rejection branch if targeted key keyword is hit
        if (key.includes('trigger-rejection-flow')) {
          return Buffer.from('tiny');
        }
        return Buffer.from('Valid Buffer Content Data Simulator String');
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [KycController],
      providers: [
        KycService,
        MockKycProvider,
        { provide: 'KycProvider', useClass: MockKycProvider }, // Bind the provider implementation token cleanly
        { provide: PrismaService, useValue: prismaMock },
        { provide: UploadsService, useValue: uploadsMock },
      ],
    }).compile();

    controller = moduleFixture.get<KycController>(KycController);
    mockKycProvider = moduleFixture.get<MockKycProvider>('KycProvider');
  });

  describe('submitKyc Integration Flow', () => {
    it('should successfully pass data across Controller -> Service -> MockProvider pipeline', async () => {
      // Setup payload matching production JSON references instead of raw express files
      const dto: SubmitKycDto = {
        documentType: KycDocumentType.PASSPORT,
        documentStorageKey: 'vault/kyc/usr-dev-123/passport-doc.jpg',
        faceScanStorageKey: 'vault/kyc/usr-dev-123/selfie-scan.jpg',
      };

      prismaMock.kycVerification.findUnique.mockResolvedValue(null);
      prismaMock.kycVerification.upsert.mockResolvedValue({
        status: KycStatus.APPROVED,
        matchScore: 95.8,
        livenessPassed: true,
        rejectionReason: null,
      });

      const result = await controller.submitKyc(mockUser, dto);

      expect(result).toBeDefined();
      expect(result.status).toBe(KycStatus.APPROVED);
      expect(result.matchScore).toBe(95.8);
      expect(result.livenessPassed).toBe(true);
      expect(uploadsMock.getFileBuffer).toHaveBeenCalledTimes(2);
    });

    it('should correctly pass variables down to provider triggers and report simulated mock rejections', async () => {
      const dto: SubmitKycDto = {
        documentType: KycDocumentType.NATIONAL_ID,
        documentStorageKey: 'vault/kyc/usr-dev-123/trigger-rejection-flow-doc.jpg', // Intercepted key keyword
        faceScanStorageKey: 'vault/kyc/usr-dev-123/selfie-scan.jpg',
      };

      prismaMock.kycVerification.findUnique.mockResolvedValue(null);
      prismaMock.kycVerification.upsert.mockResolvedValue({
        status: KycStatus.REJECTED,
        matchScore: 42.0,
        livenessPassed: true,
        rejectionReason:
          'The provided document data stream size fails standard physical feature resolution metrics.',
      });

      const result = await controller.submitKyc(mockUser, dto);

      expect(result.status).toBe(KycStatus.REJECTED);
      expect(result.matchScore).toBeLessThan(50);
      expect(result.rejectionReason).toContain('resolution metrics');
    });
  });
});
