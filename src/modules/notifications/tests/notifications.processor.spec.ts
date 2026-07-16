import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsProcessor } from '../notifications.processor';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

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
      await processor.sendInApp({
        data: {
          userId: 'user-1',
          type: 'INTERVIEW',
          title: 'Interview',
          body: 'Scheduled',
          metadata: {},
        },
      } as any);

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
      const spy = jest.spyOn((processor as any).transporter, 'sendMail').mockResolvedValue(true);

      await processor.sendEmail({
        data: {
          to: 'user@test.com',
          subject: 'Interview',
          html: '<p>Hello</p>',
        },
      } as any);

      expect(spy).toHaveBeenCalled();
    });

    it('should ignore missing email', async () => {
      await processor.sendEmail({
        data: {
          to: '',
          subject: 'test',
          html: 'test',
        },
      } as any);
    });
  });

  describe('sendTelegram', () => {
    it('should skip when bot token missing', async () => {
      configMock.get.mockReturnValue(undefined);

      await processor.sendTelegram({
        data: {
          telegramId: '123',
          message: 'hello',
        },
      } as any);
    });
  });
});
