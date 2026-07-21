import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { NotificationsProcessor } from '../notifications.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import {
  InAppPayload,
  EmailPayload,
  TelegramPayload,
  PushPayload,
  SmsPayload,
} from '../notifications.processor';

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;

  const prismaMock = {
    notification: {
      create: jest.fn(),
    },
  };

  const configMock = {
    get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
      const values: Record<string, unknown> = {
        SMTP_HOST: 'smtp.test.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user',
        SMTP_PASSWORD: 'pass',
        SMTP_SECURE: 'false',
        SMTP_FROM: 'test@test.com',
        TELEGRAM_BOT_TOKEN: 'token-123',
      };

      return (values[key] as T) ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsProcessor,

        {
          provide: PrismaService,
          useValue: prismaMock,
        },

        {
          provide: ConfigService,
          useValue: configMock,
        },
      ],
    }).compile();

    processor = module.get(NotificationsProcessor);

    jest.clearAllMocks();
  });

  describe('sendInApp', () => {
    it('should create database notification', async () => {
      const mockJob = {
        name: 'send-in-app',
        data: {
          userId: 'user-1',
          type: 'INTERVIEW',
          title: 'Interview',
          body: 'Scheduled',
          metadata: {},
        },
      } as Job<InAppPayload, void, 'send-in-app'>;

      await processor.sendInApp(mockJob);

      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'INTERVIEW',
          title: 'Interview',
          body: 'Scheduled',
          channel: 'IN_APP',
          metadata: {},
        },
      });
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const mockJob = {
        name: 'send-email',
        data: {
          to: 'user@test.com',
          subject: 'Interview',
          html: '<p>Hello</p>',
        },
      } as Job<EmailPayload, void, 'send-email'>;

      const transporter = (processor as unknown as { transporter: { sendMail: jest.Mock } })
        .transporter;
      const spy = jest.spyOn(transporter, 'sendMail').mockResolvedValue(true);

      await processor.sendEmail(mockJob);

      expect(spy).toHaveBeenCalled();
    });

    it('should ignore missing email', async () => {
      const mockJob = {
        name: 'send-email',
        data: {
          to: '',
          subject: 'test',
          html: 'test',
        },
      } as Job<EmailPayload, void, 'send-email'>;

      await processor.sendEmail(mockJob);
    });
  });

  describe('sendTelegram', () => {
    it('should skip when bot token missing', async () => {
      configMock.get.mockReturnValue(undefined);

      const mockJob = {
        name: 'send-telegram',
        data: {
          telegramId: '123',
          message: 'hello',
        },
      } as Job<TelegramPayload, void, 'send-telegram'>;

      await processor.sendTelegram(mockJob);
    });
  });

  describe('sendPush', () => {
    it('should log push notification when user id provided', async () => {
      const mockJob = {
        name: 'send-push',
        data: {
          userId: 'user-1',
          title: 'Test Push',
          body: 'Push Body',
        },
      } as Job<PushPayload, void, 'send-push'>;

      await processor.sendPush(mockJob);
    });
  });

  describe('sendSms', () => {
    it('should log sms notification when phone number provided', async () => {
      const mockJob = {
        name: 'send-sms',
        data: {
          to: '+1234567890',
          message: 'SMS message',
        },
      } as Job<SmsPayload, void, 'send-sms'>;

      await processor.sendSms(mockJob);
    });
  });
});
