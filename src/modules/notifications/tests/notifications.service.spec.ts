import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../../queues/queues.constants';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
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
});
