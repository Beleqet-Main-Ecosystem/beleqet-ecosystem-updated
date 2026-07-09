import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

import { InterviewPlannerService } from '../interview-planner.service';

import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

import { NotificationsService } from '../../notifications/notifications.service';
import { AvailabilityHelper } from '../helpers/availability.helper';
import { CommonAvailabilityHelper } from '../helpers/common-availability.helper';
import { ApplicationHelper } from '../helpers/application.helper';
import { DateHelper } from '../helpers/date.helper';

describe('InterviewPlannerService', () => {
  let service: InterviewPlannerService;

  const prismaMock = {
    userAvailability: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },

    $transaction: jest.fn(),
  };

  const i18nMock = {
    translate: jest.fn().mockResolvedValue('translated-message'),
  };

  const notificationsMock = {
    sendInterviewScheduled: jest.fn(),
  };

  const availabilityHelperMock = {
    validateAvailability: jest.fn(),
    validateInterviewConflicts: jest.fn(),
    findEarliestAvailableSlot: jest.fn(),
  };

  const commonAvailabilityHelperMock = {
    findCommonAvailability: jest.fn(),
  };

  const applicationHelperMock = {
    validateInterviewApplication: jest.fn(),
  };

  const dateHelperMock = {
    validateRange: jest.fn(async (startTime: Date, endTime: Date) => {
      if (endTime <= startTime) {
        throw new BadRequestException('translated-message');
      }
    }),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    i18nMock.translate.mockResolvedValue('translated-message');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewPlannerService,

        {
          provide: PrismaService,
          useValue: prismaMock,
        },

        {
          provide: I18nService,
          useValue: i18nMock,
        },

        {
          provide: NotificationsService,
          useValue: notificationsMock,
        },

        {
          provide: AvailabilityHelper,
          useValue: availabilityHelperMock,
        },

        {
          provide: CommonAvailabilityHelper,
          useValue: commonAvailabilityHelperMock,
        },

        {
          provide: ApplicationHelper,
          useValue: applicationHelperMock,
        },

        {
          provide: DateHelper,
          useValue: dateHelperMock,
        },
      ],
    }).compile();

    service = module.get(InterviewPlannerService);
  });

  describe('createAvailability', () => {
    it('should create availability', async () => {
      prismaMock.userAvailability.findFirst.mockResolvedValue(null);

      prismaMock.userAvailability.create.mockResolvedValue({
        id: 'slot-1',
      });

      const result = await service.createAvailability('user-1', {
        startTime: '2026-07-10T09:00:00Z',
        endTime: '2026-07-10T10:00:00Z',
        timezone: 'UTC',
      });

      expect(result.data.id).toBe('slot-1');
      expect(result.message).toBe('translated-message');
      expect(prismaMock.userAvailability.create).toHaveBeenCalled();
    });

    it('should reject invalid range', async () => {
      dateHelperMock.validateRange.mockRejectedValue(new BadRequestException('translated-message'));

      await expect(
        service.createAvailability('user-1', {
          startTime: '2026-07-10T10:00:00Z',
          endTime: '2026-07-10T09:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overlapping slot', async () => {
      prismaMock.userAvailability.findFirst.mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.createAvailability('user-1', {
          startTime: '2026-07-10T09:00:00Z',
          endTime: '2026-07-10T10:00:00Z',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
  /**
   * Tests for updating interview availability slots.
   */
  describe('updateAvailability', () => {
    it('should update an availability slot', async () => {
      prismaMock.userAvailability.findFirst
        .mockResolvedValueOnce({
          id: 'slot-1',
          userId: 'user-1',
          timezone: 'UTC',
        })
        .mockResolvedValueOnce(null);

      prismaMock.userAvailability.update.mockResolvedValue({
        id: 'slot-1',
        timezone: 'UTC',
      });

      const result = await service.updateAvailability('user-1', 'slot-1', {
        startTime: '2026-07-10T09:00:00Z',
        endTime: '2026-07-10T10:00:00Z',
        timezone: 'UTC',
      });

      expect(result.data.id).toBe('slot-1');
      expect(prismaMock.userAvailability.update).toHaveBeenCalled();
    });

    it('should throw when availability does not exist', async () => {
      prismaMock.userAvailability.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAvailability('user-1', 'missing-slot', {
          startTime: '2026-07-10T09:00:00Z',
          endTime: '2026-07-10T10:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject overlapping availability', async () => {
      prismaMock.userAvailability.findFirst
        .mockResolvedValueOnce({
          id: 'slot-1',
          userId: 'user-1',
        })
        .mockResolvedValueOnce({
          id: 'slot-2',
        });

      await expect(
        service.updateAvailability('user-1', 'slot-1', {
          startTime: '2026-07-10T09:00:00Z',
          endTime: '2026-07-10T10:00:00Z',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
  /**
   * Tests for deleting interview availability slots.
   */
  describe('deleteAvailability', () => {
    it('should delete an availability slot', async () => {
      prismaMock.userAvailability.findFirst.mockResolvedValue({
        id: 'slot-1',
        userId: 'user-1',
      });

      prismaMock.userAvailability.delete.mockResolvedValue({
        id: 'slot-1',
      });

      const result = await service.deleteAvailability('user-1', 'slot-1');

      expect(result.message).toBe('translated-message');

      expect(prismaMock.userAvailability.delete).toHaveBeenCalledWith({
        where: {
          id: 'slot-1',
        },
      });
    });

    it('should throw when deleting a missing availability', async () => {
      prismaMock.userAvailability.findFirst.mockResolvedValue(null);

      await expect(service.deleteAvailability('user-1', 'missing-slot')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
  describe('createInterview', () => {
    it('should create interview and send notification', async () => {
      applicationHelperMock.validateInterviewApplication.mockResolvedValue({
        id: 'app-1',

        userId: 'candidate-1',

        job: {
          title: 'Backend Engineer',
          interviewDurationMinutes: 60,
        },
      });

      prismaMock.$transaction.mockImplementation(async (callback) =>
        callback({
          interview: {
            create: jest.fn().mockResolvedValue({
              id: 'interview-1',

              startTime: new Date(),

              endTime: new Date(),

              timezone: 'UTC',
            }),
          },

          application: {
            update: jest.fn(),
          },
        }),
      );

      const result = await service.createInterview('employer-1', {
        applicationId: 'app-1',
        startTime: '2026-07-10T09:00:00Z',
        endTime: '2026-07-10T10:00:00Z',
      });

      expect(result.id).toBe('interview-1');

      expect(notificationsMock.sendInterviewScheduled).toHaveBeenCalled();
    });

    it('should reject wrong duration', async () => {
      applicationHelperMock.validateInterviewApplication.mockResolvedValue({
        id: 'app',

        userId: 'candidate',

        job: {
          interviewDurationMinutes: 90,
        },
      });

      await expect(
        service.createInterview('employer', {
          applicationId: 'app',
          startTime: '2026-07-10T09:00:00Z',
          endTime: '2026-07-10T10:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('autoScheduleInterview', () => {
    it('should schedule earliest slot', async () => {
      applicationHelperMock.validateInterviewApplication.mockResolvedValue({
        id: 'app',
        userId: 'candidate',
        job: {
          interviewDurationMinutes: 60,
        },
      });

      commonAvailabilityHelperMock.findCommonAvailability.mockResolvedValue([
        {
          startTime: new Date('2026-07-10T09:00:00Z'),
          endTime: new Date('2026-07-10T10:00:00Z'),
        },
      ]);

      availabilityHelperMock.findEarliestAvailableSlot.mockResolvedValue({
        startTime: new Date('2026-07-10T09:00:00Z'),
        endTime: new Date('2026-07-10T10:00:00Z'),
      });

      jest.spyOn(service, 'createInterview').mockResolvedValue({
        id: 'interview',
      } as never);

      const result = await service.autoScheduleInterview('employer', 'app');

      expect(result.id).toBe('interview');
    });

    it('should fail without common availability', async () => {
      applicationHelperMock.validateInterviewApplication.mockResolvedValue({
        userId: 'candidate',

        job: {
          interviewDurationMinutes: 60,
        },
      });

      commonAvailabilityHelperMock.findCommonAvailability.mockResolvedValue([]);

      await expect(service.autoScheduleInterview('employer', 'app')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
