import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

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
        { provide: AuthService, useValue: {} },
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
    const service = new TelegramService(settings() as never, {} as never, {} as never);
    const bot = fakeBot(service);
    await service.onModuleInit();
    expect(bot.launch).not.toHaveBeenCalled();
    expect(bot.telegram.deleteWebhook).not.toHaveBeenCalled();
    expect(bot.telegram.setChatMenuButton).not.toHaveBeenCalled();
  });

  it('listens for messages only when TELEGRAM_RECEIVE_UPDATES is true', async () => {
    const service = new TelegramService(settings('true') as never, {} as never, {} as never);
    const bot = fakeBot(service);
    await service.onModuleInit();
    expect(bot.telegram.setChatMenuButton).toHaveBeenCalled();
    expect(bot.launch).toHaveBeenCalled();
  });
});

describe('TelegramService bot registration and linking', () => {
  const prisma = {
    user: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    notificationPreference: { upsert: jest.fn() },
    eventLog: { count: jest.fn(), create: jest.fn() },
  };
  const auth = { sendEmailCodeTo: jest.fn(), confirmEmailCode: jest.fn() };
  const service = new TelegramService(
    { get: () => undefined } as never,
    prisma as never,
    auth as never,
  );

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
    prisma.user.create.mockResolvedValue({ id: 'new-id', role: 'EMPLOYER', emailVerified: false });
    const result = await service.registerFromBot({
      telegram_id: '42',
      email: 'Boss@Firm.com',
      password: 'Firm-2026!',
      role: 'employer',
    });
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
      email: 'boss@firm.com',
      emailVerified: false,
      role: 'EMPLOYER',
    });
    expect(result).toMatchObject({
      success: true,
      registered: true,
      role: 'EMPLOYER',
      status: 'approved',
      email_confirmed: false,
    });
  });

  it('stores a password chosen in the bot or the challenge, hashed, so the website works too', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'new-id', role: 'JOB_SEEKER' });
    await service.registerFromBot({
      telegram_id: '44',
      email: 'seeker@gmail.com',
      password: 'Challenge-2026',
      role: 'candidate',
    });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data.role).toBe('JOB_SEEKER');
    expect(data.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(data.passwordHash).not.toContain('Challenge-2026');
  });

  it('refuses a password shorter than 8 characters instead of dropping it', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.registerFromBot({ telegram_id: '45', email: 'a@b.com', password: 'short' }),
    ).rejects.toThrow('at least 8 characters');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('keeps no password with a placeholder email', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'new-id', role: 'JOB_SEEKER' });
    await service.registerFromBot({ telegram_id: '46', password: 'LongEnough-123' });
    expect(prisma.user.create.mock.calls[0][0].data).not.toHaveProperty('passwordHash');
  });

  it('keeps everything an employer typed: contact name, company, phone, language, username', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'e', role: 'EMPLOYER', emailVerified: false });
    await service.registerFromBot({
      telegram_id: '50',
      role: 'employer',
      company_name: 'Abebe Trading PLC',
      name: 'Abebe Trading PLC',
      contact_name: 'Abebe Kebede',
      phone: '0911223344',
      email: 'abebe@trading.et',
      password: 'Trading-2026',
      language: 'am',
      tg_username: '@abebe_k',
    });
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({
      firstName: 'Abebe',
      lastName: 'Kebede',
      phone: '0911223344',
      telegramUsername: 'abebe_k',
      headline: null,
      notificationPreference: { create: { language: 'am' } },
      company: { create: { name: 'Abebe Trading PLC' } },
    });
  });

  it('keeps the job title of a job seeker as their headline, and makes no company', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 's', role: 'JOB_SEEKER', emailVerified: false });
    await service.registerFromBot({
      telegram_id: '51',
      role: 'candidate',
      name: 'Sara Tesfaye',
      email: 'sara@gmail.com',
      password: 'Sara-2026!',
      job_title: 'Accountant',
      company_name: 'ignored',
    });
    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ firstName: 'Sara', lastName: 'Tesfaye', headline: 'Accountant' });
    expect(data).not.toHaveProperty('company');
    expect(data.notificationPreference).toEqual({ create: { language: 'en' } });
  });

  it('tells the bot the language, approval and email state of a registered person', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'u',
      role: 'EMPLOYER',
      email: 'boss@firm.com',
      emailVerified: false,
      notificationPreference: { language: 'am' },
    });
    await expect(service.checkUser('42')).resolves.toMatchObject({
      registered: true,
      role: 'employer',
      status: 'approved',
      language: 'am',
      has_email: true,
      email_confirmed: false,
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 't',
      role: 'EMPLOYER',
      email: 'tma_1@tme.beleqet.local',
      emailVerified: true,
      notificationPreference: null,
    });
    await expect(service.checkUser('1')).resolves.toMatchObject({
      language: 'en',
      has_email: false,
      email: null,
      email_confirmed: false,
    });
  });

  it('saves the language chosen with /language', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u' });
    await expect(service.updateLanguage('42', 'am')).resolves.toEqual({
      success: true,
      language: 'am',
    });
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { language: 'am' } }),
    );
  });

  it('a Telegram-only account (placeholder email) stays verified', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'new-id', role: 'JOB_SEEKER' });
    await service.registerFromBot({ telegram_id: '43' });
    expect(prisma.user.create.mock.calls[0][0].data).toMatchObject({ emailVerified: true });
  });
});

describe('TelegramService email codes for bot users', () => {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    eventLog: { count: jest.fn(), create: jest.fn() },
  };
  const auth = { sendEmailCodeTo: jest.fn(), confirmEmailCode: jest.fn() };
  const service = new TelegramService(
    { get: () => undefined } as never,
    prisma as never,
    auth as never,
  );
  const person = (fields: Record<string, unknown>) => ({
    id: 'u1',
    email: 'boss@firm.com',
    emailVerified: false,
    isActive: true,
    ...fields,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.eventLog.count.mockResolvedValue(0);
    auth.sendEmailCodeTo.mockResolvedValue(true);
  });

  it('sends a code to the address on the account', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(person({}));
    await expect(service.requestEmailCode('42')).resolves.toMatchObject({
      sent: true,
      email: 'boss@firm.com',
    });
    expect(auth.sendEmailCodeTo).toHaveBeenCalledWith('u1');
    expect(prisma.eventLog.create).toHaveBeenCalled();
  });

  it('lets a Telegram sign-up add its first real email, unconfirmed', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(person({ email: 'tma_42@tme.beleqet.local', emailVerified: true }))
      .mockResolvedValueOnce(null);
    await service.requestEmailCode('42', ' New@Firm.com ');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { email: 'new@firm.com', emailVerified: false },
    });
    expect(auth.sendEmailCodeTo).toHaveBeenCalledWith('u1');
  });

  it('refuses the email of another account, and replacing a confirmed one', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(person({}))
      .mockResolvedValueOnce({ id: 'someone-else' });
    await expect(service.requestEmailCode('42', 'taken@firm.com')).rejects.toThrow(
      'belongs to another account',
    );
    prisma.user.findUnique.mockResolvedValueOnce(person({ emailVerified: true }));
    await expect(service.requestEmailCode('42', 'other@firm.com')).rejects.toThrow(
      'already confirmed',
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(auth.sendEmailCodeTo).not.toHaveBeenCalled();
  });

  it('needs an address before a code, and refuses a placeholder one', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(
      person({ email: 'telegram_42@beleqet.internal', emailVerified: true }),
    );
    await expect(service.requestEmailCode('42')).rejects.toThrow('email address first');
    prisma.user.findUnique.mockResolvedValueOnce(person({}));
    await expect(service.requestEmailCode('42', 'x@beleqet.internal')).rejects.toThrow(
      'does not look like an email',
    );
  });

  it('allows five codes a day and one a minute', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(person({}));
    prisma.eventLog.count.mockResolvedValueOnce(5);
    await expect(service.requestEmailCode('42')).rejects.toThrow('too many codes today');
    prisma.user.findUnique.mockResolvedValueOnce(person({}));
    auth.sendEmailCodeTo.mockResolvedValueOnce(false);
    await expect(service.requestEmailCode('42')).rejects.toThrow('less than a minute ago');
  });

  it('says so when the email is already confirmed, without sending', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(person({ emailVerified: true }));
    await expect(service.requestEmailCode('42')).resolves.toMatchObject({
      sent: false,
      already_confirmed: true,
    });
    expect(auth.sendEmailCodeTo).not.toHaveBeenCalled();
  });

  it('confirms with the code the person typed, through the same check as the website', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(person({}));
    await expect(service.confirmEmailCode('42', '123 456')).resolves.toMatchObject({
      confirmed: true,
    });
    expect(auth.confirmEmailCode).toHaveBeenCalledWith('u1', '123 456');
  });

  it('refuses a Telegram account that never registered', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.requestEmailCode('404')).rejects.toThrow('not registered');
    await expect(service.confirmEmailCode('', '123456')).rejects.toThrow('not registered');
  });
});
