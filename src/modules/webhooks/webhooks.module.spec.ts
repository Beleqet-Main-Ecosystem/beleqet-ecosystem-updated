import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksModule } from './webhooks.module';
import { WebhooksController } from './controllers/webhooks.controller';
import { WebhookVerifierService } from './services/webhook-verifier.service';
import { WebhookProcessorService } from './services/webhook-processor.service';
import { WebhookRetryService } from './services/webhook-retry.service';
import { I18nService } from './services/i18n.service';
import { GDPRService } from './services/gdpr.service';

describe('WebhooksModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [WebhooksModule],
    })
      .overrideProvider('PrismaService')
      .useValue({
        walletTransaction: {
          findFirst: jest.fn(),
          update: jest.fn(),
        },
        freelancerWallet: {
          update: jest.fn(),
        },
        webhookLog: {
          findUnique: jest.fn(),
          update: jest.fn(),
          findMany: jest.fn(),
        },
        paymentTransaction: {
          findMany: jest.fn(),
          updateMany: jest.fn(),
          create: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        gdprConsent: {
          create: jest.fn(),
        },
      })
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide WebhooksController', () => {
    const controller = module.get<WebhooksController>(WebhooksController);
    expect(controller).toBeDefined();
  });

  it('should provide all services', () => {
    expect(module.get<WebhookVerifierService>(WebhookVerifierService)).toBeDefined();
    expect(module.get<WebhookProcessorService>(WebhookProcessorService)).toBeDefined();
    expect(module.get<WebhookRetryService>(WebhookRetryService)).toBeDefined();
    expect(module.get<I18nService>(I18nService)).toBeDefined();
    expect(module.get<GDPRService>(GDPRService)).toBeDefined();
  });
});
