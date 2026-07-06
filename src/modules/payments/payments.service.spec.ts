import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { ConfigService } from '@nestjs/config';

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'STRIPE_SECRET_KEY') return 'sk_test_mock_key';
    if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_mock_secret';
    return null;
  }),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});