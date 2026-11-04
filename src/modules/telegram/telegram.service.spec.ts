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

describe('TelegramService receiving updates', () => {
  const settings = (receive?: string) => ({
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string | undefined> = {
        TELEGRAM_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: '123456:test-token',
        TELEGRAM_WEBAPP_URL: 'https://beleqet.com',
        TELEGRAM_RECEIVE_UPDATES: receive,
      };
      return values[key] ?? fallback;
    }),
  });

  const fakeBot = (service: TelegramService) => {
    const bot = {
      telegram: {
        setChatMenuButton: jest.fn().mockResolvedValue(true),
        deleteWebhook: jest.fn().mockResolvedValue(true),
        setWebhook: jest.fn().mockResolvedValue(true),
        sendMessage: jest.fn().mockResolvedValue({}),
      },
      command: jest.fn(),
      on: jest.fn(),
      launch: jest.fn().mockResolvedValue(undefined),
    };
    (service as unknown as { bot: typeof bot }).bot = bot;
    return bot;
  };

  it('stays send-only by default: no polling, no menu button change', async () => {
    const service = new TelegramService(settings() as never, {} as never);
    const bot = fakeBot(service);
    await service.onModuleInit();
    expect(bot.launch).not.toHaveBeenCalled();
    expect(bot.telegram.deleteWebhook).not.toHaveBeenCalled();
    expect(bot.telegram.setChatMenuButton).not.toHaveBeenCalled();
  });

  it('listens for messages only when TELEGRAM_RECEIVE_UPDATES is true', async () => {
    const service = new TelegramService(settings('true') as never, {} as never);
    const bot = fakeBot(service);
    await service.onModuleInit();
    expect(bot.telegram.setChatMenuButton).toHaveBeenCalled();
    expect(bot.launch).toHaveBeenCalled();
  });
});
