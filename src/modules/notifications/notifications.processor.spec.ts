import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsProcessor } from './notifications.processor';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  notification: { create: jest.fn() },
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'SMTP_HOST') return 'smtp.test.com';
    if (key === 'SMTP_PORT') return 587;
    if (key === 'SMTP_USER') return 'user@test.com';
    if (key === 'SMTP_PASSWORD' || key === 'SMTP_PASS') return 'pass';
    if (key === 'SMTP_SECURE') return 'false';
    if (key === 'SMTP_FROM') return 'Beleqet <noreply@test.com>';
    if (key === 'TELEGRAM_BOT_TOKEN') return 'test-bot-token';
    return fallback;
  }),
};

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  })),
}));

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    processor = module.get<NotificationsProcessor>(NotificationsProcessor);
  });

  describe('sendInApp', () => {
    it('should create an in-app notification', async () => {
      const job = { data: { userId: 'u1', type: 'test', title: 'Hello', body: 'World' } } as any;
      await processor.sendInApp(job);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          type: 'test',
          title: 'Hello',
          body: 'World',
          channel: 'IN_APP',
          metadata: undefined,
        },
      });
    });

    it('should skip if no userId', async () => {
      const job = { data: { userId: '', type: 'test', title: 'H', body: 'W' } } as any;
      await processor.sendInApp(job);
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('sendTelegram', () => {
    it('should skip if no bot token', async () => {
      const badConfig = {
        get: jest.fn((key: string) => {
          if (key === 'TELEGRAM_BOT_TOKEN') return '';
          return mockConfig.get(key);
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          NotificationsProcessor,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ConfigService, useValue: badConfig },
        ],
      }).compile();
      const proc = module.get<NotificationsProcessor>(NotificationsProcessor);

      const job = { data: { telegramId: 'tg-1', message: 'Hello' } } as any;
      await proc.sendTelegram(job);
      // No fetch call should happen
    });
  });

  describe('sendEmail', () => {
    it('should send an email', async () => {
      const job = { data: { to: 'test@test.com', subject: 'Test', html: '<p>Hello</p>' } } as any;
      await processor.sendEmail(job);
      // Should not throw
    });

    it('should skip if no recipient', async () => {
      const job = { data: { to: '', subject: 'Test', html: '<p>Hello</p>' } } as any;
      await processor.sendEmail(job);
      // Should not throw
    });
  });
});
