import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../queues/queues.constants';

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

  it('should queue interview scheduled notifications', async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce({
        email: 'candidate@test.com',
        telegramId: '123',
      })
      .mockResolvedValueOnce({
        email: 'employer@test.com',
        telegramId: '456',
      });

    i18nMock.translate
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

  it('should not send email when user has no email', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      email: null,
      telegramId: null,
    });

    i18nMock.translate.mockResolvedValue('message');

    await service.sendInterviewScheduled(
      'interview-1',
      'employer-1',
      'candidate-1',
      'Developer',
      new Date(),
      new Date(),
      'UTC',
    );

    const emailJobs = queueMock.add.mock.calls.filter((call) => call[0] === 'SEND_EMAIL');

    expect(emailJobs.length).toBe(0);
  });
});
