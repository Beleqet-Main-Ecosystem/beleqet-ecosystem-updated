import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'TELEGRAM_BOT_TOKEN') return undefined; // disabled in tests
    return undefined;
  }),
};

const mockPrismaService = {};

describe('TelegramService', () => {
  let service: TelegramService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not throw when bot token is missing', async () => {
    await expect(service.onModuleInit()).resolves.not.toThrow();
  });

  it('handleWebhookUpdate should return ok false when bot is disabled', async () => {
    const result = await service.handleWebhookUpdate({ update_id: 1 });
    expect(result).toEqual({ ok: false, reason: expect.any(String) });
  });

  it('sendNotification should safely return false without throwing when bot is disabled', async () => {
    const result = await service.sendNotification('12345', 'Test alert', '/wallet');
    expect(result).toBe(false);
  });
});
