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

describe('TelegramService bot registration and linking', () => {
  const prisma = {
    user: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const service = new TelegramService({ get: () => undefined } as never, prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('never links a Telegram account to a user ID (account takeover)', async () => {
    const result = await service.linkTelegramByToken('victim-user-id', '900000002');
    expect(result.success).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses an email that already has an account, without revealing its ID', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'victim-id' });
    await expect(
      service.registerFromBot({ telegram_id: '900000001', email: 'victim@example.com' }),
    ).rejects.toThrow('Email already registered');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates a new account without marking a typed email as verified', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'new-id', role: 'EMPLOYER' });
    const result = await service.registerFromBot({
      telegram_id: '42',
      email: 'Boss@Firm.com',
      role: 'employer',
    });
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
      email: 'boss@firm.com',
      emailVerified: false,
      role: 'EMPLOYER',
    });
    expect(result).toEqual({ success: true, registered: true, role: 'EMPLOYER' });
  });

  it('a Telegram-only account (placeholder email) stays verified', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'new-id', role: 'JOB_SEEKER' });
    await service.registerFromBot({ telegram_id: '43' });
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({ emailVerified: true });
  });
});
