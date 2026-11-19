import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AvailabilityHelper } from '../../helpers/availability.helper';
import { PrismaService } from '../../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
describe('AvailabilityHelper', () => {
  let helper: AvailabilityHelper;

  const prismaMock = {
    interview: {
      findFirst: jest.fn(),
    },
  };
  const i18nMock = {
    translate: jest.fn().mockResolvedValue('translated-message'),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityHelper,

        {
          provide: PrismaService,
          useValue: prismaMock,
        },

        {
          provide: I18nService,
          useValue: i18nMock,
        },
      ],
    }).compile();

    helper = module.get<AvailabilityHelper>(AvailabilityHelper);

    jest.clearAllMocks();
  });

  describe('validateAvailability', () => {
    it('should pass when both employer and candidate are available', async () => {
      const clientMock = {
        userAvailability: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: 'employer-slot',
            })
            .mockResolvedValueOnce({
              id: 'candidate-slot',
            }),
        },
      };
      await expect(
        helper.validateAvailability(
          clientMock as any,
          'employer-id',
          'candidate-id',
          new Date('2026-07-30T10:00:00Z'),
          new Date('2026-07-30T11:00:00Z'),
        ),
      ).resolves.not.toThrow();
    });

    it('should throw error when employer is unavailable', async () => {
      const clientMock = {
        userAvailability: {
          findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
            id: 'candidate-slot',
          }),
        },
      };

      await expect(
        helper.validateAvailability(
          clientMock as any,
          'employer-id',
          'candidate-id',
          new Date(),
          new Date(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw error when candidate is unavailable', async () => {
      const clientMock = {
        userAvailability: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: 'employer-slot',
            })
            .mockResolvedValueOnce(null),
        },
      };

      await expect(
        helper.validateAvailability(
          clientMock as any,
          'employer-id',
          'candidate-id',
          new Date(),
          new Date(),
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('validateInterviewConflicts', () => {
    it('should pass when there is no existing interview conflict', async () => {
      const clientMock = {
        interview: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      await expect(
        helper.validateInterviewConflicts(
          clientMock as any,
          'employer-id',
          'candidate-id',
          new Date(),
          new Date(),
        ),
      ).resolves.not.toThrow();
    });

    it('should throw error when candidate has another interview', async () => {
      const clientMock = {
        interview: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce({
              id: 'candidate-interview',
            })
            .mockResolvedValueOnce(null),
        },
      };

      await expect(
        helper.validateInterviewConflicts(
          clientMock as any,
          'employer-id',
          'candidate-id',
          new Date(),
          new Date(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw error when employer has another interview', async () => {
      const clientMock = {
        interview: {
          findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
            id: 'employer-interview',
          }),
        },
      };

      await expect(
        helper.validateInterviewConflicts(
          clientMock as any,
          'employer-id',
          'candidate-id',
          new Date(),
          new Date(),
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findEarliestAvailableSlot', () => {
    it('should return earliest available interview slot', async () => {
      prismaMock.interview.findFirst.mockResolvedValue(null);

      const commonSlots = [
        {
          startTime: new Date('2026-07-30T09:00:00Z'),

          endTime: new Date('2026-07-30T12:00:00Z'),

          timezone: 'UTC',
        },
      ];

      const result = await helper.findEarliestAvailableSlot(
        commonSlots,
        'employer-id',
        'candidate-id',
        60,
      );

      expect(result).toEqual({
        startTime: new Date('2026-07-30T09:00:00Z'),

        endTime: new Date('2026-07-30T10:00:00Z'),

        timezone: 'UTC',
      });
    });
    it('should skip conflicting slot and return next available slot', async () => {
      prismaMock.interview.findFirst
        .mockResolvedValueOnce({
          id: 'existing-interview',
        })
        .mockResolvedValue(null);

      const result = await helper.findEarliestAvailableSlot(
        [
          {
            startTime: new Date('2026-07-30T09:00:00Z'),

            endTime: new Date('2026-07-30T11:00:00Z'),

            timezone: 'UTC',
          },
        ],
        'employer-id',
        'candidate-id',
        60,
      );

      expect(result?.startTime).toEqual(new Date('2026-07-30T10:00:00Z'));
    });

    it('should return null when no slot is available', async () => {
      prismaMock.interview.findFirst.mockResolvedValue({
        id: 'busy-interview',
      });

      const result = await helper.findEarliestAvailableSlot(
        [
          {
            startTime: new Date('2026-07-30T09:00:00Z'),

            endTime: new Date('2026-07-30T10:00:00Z'),

            timezone: 'UTC',
          },
        ],

        'employer-id',

        'candidate-id',

        60,
      );

      expect(result).toBeNull();
    });
  });
});
