import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../../queues/queues.constants';

jest.mock('../email-templates', () => ({
  adminAnnouncementEmail: jest.fn().mockResolvedValue({
    subject: 'Announcement',
    html: '<p>body</p>',
  }),
}));

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const i18nMock = {
    translate: jest.fn(),
  };

  const queueMock = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,

        {
          provide: PrismaService,
          useValue: prismaMock,
        },

        {
          provide: I18nService,
          useValue: i18nMock,
        },

        {
          provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS),
          useValue: queueMock,
        },
      ],
    }).compile();

    service = module.get(NotificationsService);

    jest.clearAllMocks();
  });

  describe('sendInterviewScheduled', () => {
    it('should queue interview scheduled notifications when default preferences are active', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({
          email: 'candidate@test.com',
          phone: '+1234567890',
          telegramId: '123',
          notificationPreference: {
            inAppEnabled: true,
            emailEnabled: true,
            telegramEnabled: true,
            pushEnabled: false,
            smsEnabled: false,
            language: 'en',
          },
        })
        .mockResolvedValueOnce({
          email: 'employer@test.com',
          phone: '+0987654321',
          telegramId: '456',
          notificationPreference: {
            inAppEnabled: true,
            emailEnabled: true,
            telegramEnabled: true,
            pushEnabled: false,
            smsEnabled: false,
            language: 'en',
          },
        });

      i18nMock.translate
        .mockResolvedValueOnce('Interview Scheduled')
        .mockResolvedValueOnce('Interview Scheduled')
        .mockResolvedValueOnce('Candidate message')
        .mockResolvedValueOnce('Employer message');

      await service.sendInterviewScheduled(
        'interview-1',
        'employer-1',
        'candidate-1',
        'Backend Developer',
        new Date('2026-07-30T15:55:00Z'),
        new Date('2026-07-30T16:15:00Z'),
        'UTC',
      );

      expect(queueMock.add).toHaveBeenCalled();
      expect(queueMock.add.mock.calls.length).toBe(6);
    });

    it('should not queue email job when user disables email preference', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({
          email: 'candidate@test.com',
          phone: '+1234567890',
          telegramId: '123',
          notificationPreference: {
            inAppEnabled: true,
            emailEnabled: false,
            telegramEnabled: true,
            pushEnabled: false,
            smsEnabled: false,
            language: 'en',
          },
        })
        .mockResolvedValueOnce({
          email: 'employer@test.com',
          phone: '+0987654321',
          telegramId: '456',
          notificationPreference: {
            inAppEnabled: true,
            emailEnabled: false,
            telegramEnabled: true,
            pushEnabled: false,
            smsEnabled: false,
            language: 'en',
          },
        });

      i18nMock.translate.mockResolvedValue('Message');

      await service.sendInterviewScheduled(
        'interview-1',
        'employer-1',
        'candidate-1',
        'Developer',
        new Date(),
        new Date(),
        'UTC',
      );

      const emailJobs = queueMock.add.mock.calls.filter(
        (call) => call[0] === NOTIFICATION_JOBS.SEND_EMAIL,
      );
      expect(emailJobs.length).toBe(0);
    });

    it('should not queue in-app job when user disables in-app preference', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({
          email: 'candidate@test.com',
          phone: '+1234567890',
          telegramId: '123',
          notificationPreference: {
            inAppEnabled: false,
            emailEnabled: true,
            telegramEnabled: true,
            pushEnabled: false,
            smsEnabled: false,
            language: 'en',
          },
        })
        .mockResolvedValueOnce({
          email: 'employer@test.com',
          phone: '+0987654321',
          telegramId: '456',
          notificationPreference: {
            inAppEnabled: false,
            emailEnabled: true,
            telegramEnabled: true,
            pushEnabled: false,
            smsEnabled: false,
            language: 'en',
          },
        });

      i18nMock.translate.mockResolvedValue('Message');

      await service.sendInterviewScheduled(
        'interview-1',
        'employer-1',
        'candidate-1',
        'Developer',
        new Date(),
        new Date(),
        'UTC',
      );

      const inAppJobs = queueMock.add.mock.calls.filter(
        (call) => call[0] === NOTIFICATION_JOBS.SEND_IN_APP,
      );
      expect(inAppJobs.length).toBe(0);
    });

    it('should queue push and sms jobs when enabled in user preferences', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({
          email: 'candidate@test.com',
          phone: '+1234567890',
          telegramId: '123',
          notificationPreference: {
            inAppEnabled: true,
            emailEnabled: true,
            telegramEnabled: true,
            pushEnabled: true,
            smsEnabled: true,
            language: 'en',
          },
        })
        .mockResolvedValueOnce({
          email: 'employer@test.com',
          phone: '+0987654321',
          telegramId: '456',
          notificationPreference: {
            inAppEnabled: true,
            emailEnabled: true,
            telegramEnabled: true,
            pushEnabled: true,
            smsEnabled: true,
            language: 'en',
          },
        });

      i18nMock.translate.mockResolvedValue('Message');

      await service.sendInterviewScheduled(
        'interview-1',
        'employer-1',
        'candidate-1',
        'Developer',
        new Date(),
        new Date(),
        'UTC',
      );

      const pushJobs = queueMock.add.mock.calls.filter(
        (call) => call[0] === NOTIFICATION_JOBS.SEND_PUSH,
      );
      const smsJobs = queueMock.add.mock.calls.filter(
        (call) => call[0] === NOTIFICATION_JOBS.SEND_SMS,
      );

      expect(pushJobs.length).toBe(2);
      expect(smsJobs.length).toBe(2);
    });

    it('should escape Markdown in Telegram payloads to prevent parse errors', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce({
          email: 'candidate@test.com',
          phone: null,
          telegramId: '111',
          notificationPreference: {
            inAppEnabled: false,
            emailEnabled: false,
            telegramEnabled: true,
            pushEnabled: false,
            smsEnabled: false,
            language: 'en',
          },
        })
        .mockResolvedValueOnce({
          email: 'employer@test.com',
          phone: null,
          telegramId: '222',
          notificationPreference: {
            inAppEnabled: false,
            emailEnabled: false,
            telegramEnabled: true,
            pushEnabled: false,
            smsEnabled: false,
            language: 'en',
          },
        });

      i18nMock.translate
        .mockResolvedValueOnce('Interview Scheduled')
        .mockResolvedValueOnce('Interview Scheduled')
        .mockResolvedValueOnce('Interview for *C++* Dev')
        .mockResolvedValueOnce('Interview for _Full_ Stack');

      await service.sendInterviewScheduled(
        'interview-1',
        'employer-1',
        'candidate-1',
        'Senior Dev',
        new Date(),
        new Date(),
        'UTC',
      );

      const telegramJobs = queueMock.add.mock.calls.filter(
        (call) => call[0] === NOTIFICATION_JOBS.SEND_TELEGRAM,
      );
      expect(telegramJobs.length).toBe(2);

      expect(telegramJobs[0][1].message).toBe('Interview for \\*C++\\* Dev');
      expect(telegramJobs[1][1].message).toBe('Interview for \\_Full\\_ Stack');
    });
  });

  describe('sendSystemAlert', () => {
    const activeUsers = [
      {
        id: 'user-1',
        email: 'alice@test.com',
        firstName: 'Alice',
        telegramId: 'tg-1',
        notificationPreference: {
          inAppEnabled: true,
          emailEnabled: true,
          telegramEnabled: true,
          pushEnabled: false,
          smsEnabled: false,
          language: 'en',
        },
      },
      {
        id: 'user-2',
        email: 'bob@test.com',
        firstName: 'Bob',
        telegramId: 'tg-2',
        notificationPreference: {
          inAppEnabled: true,
          emailEnabled: true,
          telegramEnabled: true,
          pushEnabled: false,
          smsEnabled: false,
          language: 'en',
        },
      },
    ];

    it('should enqueue in-app, email, and Telegram for each active user', async () => {
      prismaMock.user.findMany.mockResolvedValue(activeUsers);

      const count = await service.sendSystemAlert('ADMIN_ANNOUNCEMENT', 'System maintenance tonight');

      expect(count).toBe(2);
      expect(queueMock.add).toHaveBeenCalled();

      const inAppJobs = queueMock.add.mock.calls.filter(
        (c) => c[0] === NOTIFICATION_JOBS.SEND_IN_APP,
      );
      const emailJobs = queueMock.add.mock.calls.filter(
        (c) => c[0] === NOTIFICATION_JOBS.SEND_EMAIL,
      );
      const telegramJobs = queueMock.add.mock.calls.filter(
        (c) => c[0] === NOTIFICATION_JOBS.SEND_TELEGRAM,
      );

      expect(inAppJobs.length).toBe(2);
      expect(emailJobs.length).toBe(2);
      expect(telegramJobs.length).toBe(2);
    });

    it('should skip channels disabled by user preference', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        {
          ...activeUsers[0],
          notificationPreference: {
            inAppEnabled: false,
            emailEnabled: false,
            telegramEnabled: false,
            pushEnabled: false,
            smsEnabled: false,
            language: 'en',
          },
        },
      ]);

      const count = await service.sendSystemAlert('ADMIN_ANNOUNCEMENT', 'Alert');

      expect(count).toBe(1);
      expect(queueMock.add).not.toHaveBeenCalled();
    });

    it('should fall back to default preferences when none exist', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: 'user-3',
          email: 'carol@test.com',
          firstName: 'Carol',
          telegramId: 'tg-3',
          notificationPreference: null,
        },
      ]);

      const count = await service.sendSystemAlert('ADMIN_ANNOUNCEMENT', 'Hello world');

      expect(count).toBe(1);
      const inAppJobs = queueMock.add.mock.calls.filter(
        (c) => c[0] === NOTIFICATION_JOBS.SEND_IN_APP,
      );
      expect(inAppJobs.length).toBe(1);
    });

    it('should escape Markdown characters in Telegram payloads', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        {
          ...activeUsers[0],
          notificationPreference: {
            inAppEnabled: false,
            emailEnabled: false,
            telegramEnabled: true,
            pushEnabled: false,
            smsEnabled: false,
            language: 'en',
          },
        },
      ]);

      await service.sendSystemAlert('ADMIN_ANNOUNCEMENT', 'Rate _changed_ to *5%*');

      const telegramJobs = queueMock.add.mock.calls.filter(
        (c) => c[0] === NOTIFICATION_JOBS.SEND_TELEGRAM,
      );
      expect(telegramJobs.length).toBe(1);
      expect(telegramJobs[0][1].message).toBe('Rate \\_changed\\_ to \\*5%\\*');
    });

    it('should return 0 when no active users exist', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);

      const count = await service.sendSystemAlert('ADMIN_ANNOUNCEMENT', 'Alert');

      expect(count).toBe(0);
      expect(queueMock.add).not.toHaveBeenCalled();
    });
  });
});
