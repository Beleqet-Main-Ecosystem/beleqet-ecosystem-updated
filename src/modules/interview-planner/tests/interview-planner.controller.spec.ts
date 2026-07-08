import { Test, TestingModule } from '@nestjs/testing';
import { InterviewPlannerController } from '../interview-planner.controller';
import { InterviewPlannerService } from '../interview-planner.service';

describe('InterviewPlannerController', () => {
  let controller: InterviewPlannerController;

  const serviceMock = {
    createAvailability: jest.fn(),

    getUserAvailabilities: jest.fn(),

    autoScheduleInterview: jest.fn(),

    findCommonAvailability: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InterviewPlannerController],

      providers: [
        {
          provide: InterviewPlannerService,

          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<InterviewPlannerController>(InterviewPlannerController);

    jest.clearAllMocks();
  });

  describe('createAvailability', () => {
    it('should create availability for logged user', async () => {
      const request = {
        user: {
          userId: 'user-1',
        },
      };

      const dto = {
        startTime: '2026-07-30T10:00:00Z',

        endTime: '2026-07-30T11:00:00Z',
      };

      serviceMock.createAvailability.mockResolvedValue({
        id: 'slot-1',
      });

      const result = await controller.createAvailability(request as any, dto);

      expect(serviceMock.createAvailability).toHaveBeenCalledWith('user-1', dto);

      expect(result).toEqual({
        id: 'slot-1',
      });
    });
  });

  describe('getAvailability', () => {
    it('should return user availability slots', async () => {
      const request = {
        user: {
          userId: 'user-1',
        },
      };

      serviceMock.getUserAvailabilities.mockResolvedValue([
        {
          id: 'slot-1',
        },
      ]);

      const result = await controller.getAvailability(request as any);

      expect(serviceMock.getUserAvailabilities).toHaveBeenCalledWith('user-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('autoScheduleInterview', () => {
    it('should automatically schedule interview', async () => {
      const request = {
        user: {
          userId: 'employer-1',
        },
      };

      const dto = {
        applicationId: 'application-1',
      };

      serviceMock.autoScheduleInterview.mockResolvedValue({
        id: 'interview-1',
      });

      const result = await controller.autoScheduleInterview(request as any, dto);

      expect(serviceMock.autoScheduleInterview).toHaveBeenCalledWith('employer-1', 'application-1');

      expect(result).toEqual({
        id: 'interview-1',
      });
    });
  });
});
