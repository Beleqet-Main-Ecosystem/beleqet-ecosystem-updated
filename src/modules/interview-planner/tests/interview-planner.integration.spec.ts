/**
 * @file interview-planner.integration.spec.ts
 *
 * Integration tests for Interview Planner module.
 *
 * Covers:
 * - Availability creation
 * - Availability conflict detection
 * - Automatic interview scheduling
 * - Notification triggering
 * - Availability update
 * - Availability deletion
 *
 * External dependencies mocked:
 * - Prisma database
 * - Notification service
 * - i18n service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';

import { InterviewPlannerService } from '../interview-planner.service';

import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

import { DateHelper } from '../helpers/date.helper';
import { AvailabilityHelper } from '../helpers/availability.helper';
import { CommonAvailabilityHelper } from '../helpers/common-availability.helper';
import { ApplicationHelper } from '../helpers/application.helper';

import { I18nService } from 'nestjs-i18n';

describe('Interview Planner Integration', () => {
  let service: InterviewPlannerService;

  const prismaMock = {
    $transaction: jest.fn(async (callback) => {
      return callback({
        userAvailability: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'availability-1',
            userId: 'employer-1',
            startTime: new Date('2026-07-10T10:00:00Z'),
            endTime: new Date('2026-07-10T12:00:00Z'),
            timezone: 'Africa/Addis_Ababa',
          }),

          update: jest.fn().mockResolvedValue({}),
        },

        interview: {
          findFirst: jest.fn().mockResolvedValue(null),

          create: jest.fn().mockResolvedValue({
            id: 'interview-1',
            employerId: 'employer-1',
            candidateId: 'candidate-1',
            startTime: new Date('2026-07-10T10:00:00Z'),
            endTime: new Date('2026-07-10T11:00:00Z'),
            status: 'SCHEDULED',
          }),
        },

        application: {
          update: jest.fn().mockResolvedValue({
            id: 'application-1',
            status: 'INTERVIEW_SCHEDULED',
          }),
        },
      });
    }),
    userAvailability: {
      create: jest.fn(),

      findFirst: jest.fn(),

      findUnique: jest.fn(),

      findMany: jest.fn(),

      update: jest.fn(),

      delete: jest.fn(),
    },

    interview: {
      create: jest.fn(),

      findFirst: jest.fn(),

      findUnique: jest.fn(),
    },
  };

  const notificationMock = {
    sendInterviewScheduled: jest.fn().mockResolvedValue(undefined),
  };

  const i18nMock = {
    translate: jest.fn().mockResolvedValue('translated message'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewPlannerService,

        {
          provide: PrismaService,
          useValue: prismaMock,
        },

        {
          provide: NotificationsService,
          useValue: notificationMock,
        },

        {
          provide: I18nService,
          useValue: i18nMock,
        },

        DateHelper,

        AvailabilityHelper,

        CommonAvailabilityHelper,

        {
          provide: ApplicationHelper,

          useValue: {
            validateInterviewApplication: jest.fn().mockResolvedValue({
              id: 'application-1',

              userId: 'candidate-1',

              job: {
                interviewDurationMinutes: 60,
              },
            }),
          },
        },
      ],
    }).compile();

    service = module.get<InterviewPlannerService>(InterviewPlannerService);

    jest.clearAllMocks();
  });

  describe('Create Availability', () => {
    it('should create user availability successfully', async () => {
      prismaMock.userAvailability.findFirst.mockResolvedValue(null);

      prismaMock.userAvailability.create.mockResolvedValue({
        id: 'availability-1',

        userId: 'user-1',

        startTime: new Date('2026-07-10T10:00:00Z'),

        endTime: new Date('2026-07-10T12:00:00Z'),

        timezone: 'Africa/Addis_Ababa',
      });

      const result = await service.createAvailability(
        'user-1',

        {
          startTime: '2026-07-10T10:00:00Z',

          endTime: '2026-07-10T12:00:00Z',

          timezone: 'Africa/Addis_Ababa',
        },
      );

      expect(prismaMock.userAvailability.create).toHaveBeenCalled();

      expect(result.data.id).toBe('availability-1');
    });
  });

  describe('Availability conflict', () => {
    it('should reject overlapping availability', async () => {
      prismaMock.userAvailability.findFirst.mockResolvedValue({
        id: 'existing-slot',
      });

      await expect(
        service.createAvailability(
          'user-1',

          {
            startTime: '2026-07-10T10:00:00Z',

            endTime: '2026-07-10T12:00:00Z',

            timezone: 'Africa/Addis_Ababa',
          },
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Auto Schedule Interview', () => {
    it('should automatically schedule interview and notify users', async () => {
      jest.spyOn(service, 'findCommonAvailability').mockResolvedValue([
        {
          startTime: new Date('2026-07-10T10:00:00Z'),
          endTime: new Date('2026-07-10T12:00:00Z'),
          timezone: 'Africa/Addis_Ababa',
        },
      ]);

      prismaMock.interview.findFirst.mockResolvedValue(null);

      const transactionInterviewCreate = jest.fn().mockResolvedValue({
        id: 'interview-1',
        startTime: new Date('2026-07-10T10:00:00Z'),
        endTime: new Date('2026-07-10T11:00:00Z'),
      });

      const transactionApplicationUpdate = jest.fn().mockResolvedValue({
        id: 'application-1',
        status: 'INTERVIEW_SCHEDULED',
      });

      prismaMock.$transaction = jest.fn(async (callback) => {
        return callback({
          userAvailability: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'availability-1',
              userId: 'employer-1',
            }),
          },

          interview: {
            findFirst: jest.fn().mockResolvedValue(null),

            create: transactionInterviewCreate,
          },

          application: {
            update: transactionApplicationUpdate,
          },
        });
      });

      await service.autoScheduleInterview('employer-1', 'application-1');

      expect(transactionInterviewCreate).toHaveBeenCalled();

      expect(transactionApplicationUpdate).toHaveBeenCalled();

      expect(notificationMock.sendInterviewScheduled).toHaveBeenCalled();
    });
  });

  describe('Update Availability', () => {
    it('should update existing availability successfully', async () => {
      prismaMock.userAvailability.findFirst
        .mockResolvedValueOnce({
          id: 'slot-1',
          userId: 'user-1',
          startTime: new Date('2026-07-10T10:00:00Z'),
          endTime: new Date('2026-07-10T12:00:00Z'),
          timezone: 'Africa/Addis_Ababa',
        })
        .mockResolvedValueOnce(null);

      prismaMock.userAvailability.update.mockResolvedValue({
        id: 'slot-1',
        userId: 'user-1',
        startTime: new Date('2026-07-11T10:00:00Z'),
        endTime: new Date('2026-07-11T12:00:00Z'),
        timezone: 'Africa/Addis_Ababa',
      });

      const result = await service.updateAvailability('user-1', 'slot-1', {
        startTime: '2026-07-11T10:00:00Z',
        endTime: '2026-07-11T12:00:00Z',
        timezone: 'Africa/Addis_Ababa',
      });

      expect(prismaMock.userAvailability.update).toHaveBeenCalledWith({
        where: {
          id: 'slot-1',
        },
        data: {
          startTime: new Date('2026-07-11T10:00:00Z'),
          endTime: new Date('2026-07-11T12:00:00Z'),
          timezone: 'Africa/Addis_Ababa',
        },
      });

      expect(result.data.id).toBe('slot-1');
    });
  });

  describe('Delete Availability', () => {
    it('should delete availability successfully', async () => {
      prismaMock.userAvailability.findFirst.mockResolvedValue({
        id: 'slot-1',
        userId: 'user-1',
      });

      prismaMock.userAvailability.delete.mockResolvedValue({
        id: 'slot-1',
      });

      const result = await service.deleteAvailability('user-1', 'slot-1');

      expect(prismaMock.userAvailability.delete).toHaveBeenCalledWith({
        where: {
          id: 'slot-1',
        },
      });

      expect(result.message).toBe('translated message');
    });
  });
});
