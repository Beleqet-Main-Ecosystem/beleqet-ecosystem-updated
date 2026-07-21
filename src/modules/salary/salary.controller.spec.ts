import { Test, TestingModule } from '@nestjs/testing';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { ExperienceLevel } from './dto/salary-prediction.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SalaryController', () => {
  let controller: SalaryController;
  let _service: SalaryService;

  const mockSalaryService = {
    predictSalary: jest.fn(),
    batchPredict: jest.fn(),
    getPredictions: jest.fn(),
    getSalaryStatistics: jest.fn(),
    getSalaryHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalaryController],
      providers: [
        {
          provide: SalaryService,
          useValue: mockSalaryService,
        },
      ],
    }).compile();

    controller = module.get<SalaryController>(SalaryController);
    service = module.get<SalaryService>(SalaryService);

    jest.clearAllMocks();
  });

  describe('POST /predict', () => {
    it('should predict salary successfully', async () => {
      const dto = {
        jobTitle: 'Senior Developer',
        location: 'Addis Ababa',
        experienceLevel: ExperienceLevel.SENIOR,
        industry: 'Technology',
        currency: 'ETB',
      };

      const mockResponse = {
        id: '1',
        jobTitle: 'Senior Developer',
        location: 'Addis Ababa',
        experienceLevel: 'SENIOR',
        industry: 'Technology',
        minSalary: 100000,
        maxSalary: 200000,
        averageSalary: 150000,
        medianSalary: 145000,
        currency: 'ETB',
        dataPointsCount: 50,
        standardDeviation: 25000,
        confidenceScore: 0.85,
        version: 1,
        lastUpdatedAt: new Date(),
        createdAt: new Date(),
      };

      mockSalaryService.predictSalary.mockResolvedValue(mockResponse);

      const result = await controller.predictSalary(dto);

      expect(result).toBeDefined();
      expect(result.jobTitle).toBe('Senior Developer');
      expect(result.averageSalary).toBe(150000);
      expect(mockSalaryService.predictSalary).toHaveBeenCalledWith(dto);
    });

    it('should handle prediction errors', async () => {
      const dto = {
        jobTitle: '',
        location: 'Addis Ababa',
        experienceLevel: ExperienceLevel.SENIOR,
      };

      mockSalaryService.predictSalary.mockRejectedValue(
        new BadRequestException('Job title is required'),
      );

      await expect(controller.predictSalary(dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /predict-batch', () => {
    it('should batch predict salaries', async () => {
      const dto = {
        predictions: [
          {
            jobTitle: 'Developer',
            location: 'Addis Ababa',
            experienceLevel: ExperienceLevel.MID,
          },
          {
            jobTitle: 'Designer',
            location: 'Addis Ababa',
            experienceLevel: ExperienceLevel.SENIOR,
          },
        ],
      };

      const mockResponse = {
        predictions: [
          {
            id: '1',
            jobTitle: 'Developer',
            location: 'Addis Ababa',
            experienceLevel: 'MID',
            industry: null,
            minSalary: 50000,
            maxSalary: 100000,
            averageSalary: 75000,
            medianSalary: 72000,
            currency: 'ETB',
            dataPointsCount: 30,
            standardDeviation: 12500,
            confidenceScore: 0.75,
            version: 1,
            lastUpdatedAt: new Date(),
            createdAt: new Date(),
          },
          {
            id: '2',
            jobTitle: 'Designer',
            location: 'Addis Ababa',
            experienceLevel: 'SENIOR',
            industry: null,
            minSalary: 60000,
            maxSalary: 120000,
            averageSalary: 90000,
            medianSalary: 87000,
            currency: 'ETB',
            dataPointsCount: 35,
            standardDeviation: 15000,
            confidenceScore: 0.78,
            version: 1,
            lastUpdatedAt: new Date(),
            createdAt: new Date(),
          },
        ],
        processedAt: new Date(),
        successCount: 2,
        failureCount: 0,
      };

      mockSalaryService.batchPredict.mockResolvedValue(mockResponse);

      const result = await controller.batchPredict(dto as any);

      expect(result).toBeDefined();
      expect(result.predictions).toHaveLength(2);
      expect(result.successCount).toBe(2);
      expect(mockSalaryService.batchPredict).toHaveBeenCalled();
    });

    it('should reject batch exceeding limit', async () => {
      const largeBatch = {
        predictions: Array.from({ length: 51 }, () => ({
          jobTitle: 'Developer',
          location: 'Addis Ababa',
          experienceLevel: ExperienceLevel.MID,
        })),
      };

      mockSalaryService.batchPredict.mockRejectedValue(
        new BadRequestException('Maximum 50 predictions per batch allowed'),
      );

      await expect(controller.batchPredict(largeBatch as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /predictions', () => {
    it('should get predictions with filters', async () => {
      const query = {
        jobTitle: 'Developer',
        location: 'Addis Ababa',
        page: 1,
        limit: 20,
      };

      const mockResponse = {
        data: [
          {
            id: '1',
            jobTitle: 'Developer',
            location: 'Addis Ababa',
            experienceLevel: 'MID',
            industry: 'Technology',
            minSalary: 50000,
            maxSalary: 100000,
            averageSalary: 75000,
            medianSalary: 72000,
            currency: 'ETB',
            dataPointsCount: 30,
            standardDeviation: 12500,
            confidenceScore: 0.75,
            version: 1,
            lastUpdatedAt: new Date(),
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      };

      mockSalaryService.getPredictions.mockResolvedValue(mockResponse);

      const result = await controller.getPredictions(query as any);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockSalaryService.getPredictions).toHaveBeenCalledWith(query);
    });

    it('should handle pagination', async () => {
      const query = {
        page: 2,
        limit: 10,
      };

      mockSalaryService.getPredictions.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 10,
      });

      const result = await controller.getPredictions(query as any);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });
  });

  describe('GET /statistics/:location', () => {
    it('should get salary statistics', async () => {
      const location = 'Addis Ababa';
      const mockResponse = {
        location: 'Addis Ababa',
        industry: 'Technology',
        experienceLevel: 'MID',
        averageSalary: 150000,
        medianSalary: 145000,
        salaryGrowthRate: 2.5,
        currency: 'ETB',
        dataPointsCount: 50,
        periodStartDate: new Date(),
        periodEndDate: new Date(),
      };

      mockSalaryService.getSalaryStatistics.mockResolvedValue(mockResponse);

      const result = await controller.getSalaryStatistics(location);

      expect(result).toBeDefined();
      expect(result.location).toBe(location);
      expect(result.averageSalary).toBe(150000);
      expect(mockSalaryService.getSalaryStatistics).toHaveBeenCalledWith(
        location,
        undefined,
        30,
        'ETB',
      );
    });

    it('should filter statistics by industry', async () => {
      const location = 'Addis Ababa';
      const industry = 'Technology';

      mockSalaryService.getSalaryStatistics.mockResolvedValue({});

      await controller.getSalaryStatistics(location, industry);

      expect(mockSalaryService.getSalaryStatistics).toHaveBeenCalledWith(
        location,
        industry,
        30,
        'ETB',
      );
    });

    it('should support currency parameter', async () => {
      const location = 'Addis Ababa';
      const currency = 'USD';

      mockSalaryService.getSalaryStatistics.mockResolvedValue({});

      await controller.getSalaryStatistics(location, undefined, undefined, currency);

      expect(mockSalaryService.getSalaryStatistics).toHaveBeenCalledWith(
        location,
        undefined,
        30,
        'USD',
      );
    });

    it('should handle not found error', async () => {
      const location = 'UnknownLocation';

      mockSalaryService.getSalaryStatistics.mockRejectedValue(
        new NotFoundException(`No salary data found for ${location}`),
      );

      await expect(controller.getSalaryStatistics(location)).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /history/:jobTitle/:location', () => {
    it('should get salary history', async () => {
      const jobTitle = 'Senior Developer';
      const location = 'Addis Ababa';

      const mockResponse = [
        {
          jobTitle: 'Senior Developer',
          location: 'Addis Ababa',
          industry: 'Technology',
          experienceLevel: 'SENIOR',
          averageSalary: 140000,
          medianSalary: 135000,
          salaryGrowthRate: 0,
          currency: 'ETB',
          dataPointsCount: 45,
          periodStartDate: new Date(),
          periodEndDate: new Date(),
        },
        {
          jobTitle: 'Senior Developer',
          location: 'Addis Ababa',
          industry: 'Technology',
          experienceLevel: 'SENIOR',
          averageSalary: 130000,
          medianSalary: 125000,
          salaryGrowthRate: 0,
          currency: 'ETB',
          dataPointsCount: 40,
          periodStartDate: new Date(),
          periodEndDate: new Date(),
        },
      ];

      mockSalaryService.getSalaryHistory.mockResolvedValue(mockResponse);

      const result = await controller.getSalaryHistory(jobTitle, location);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(mockSalaryService.getSalaryHistory).toHaveBeenCalledWith(jobTitle, location, 12);
    });

    it('should limit history results', async () => {
      const jobTitle = 'Developer';
      const location = 'Addis Ababa';
      const limit = '6';

      mockSalaryService.getSalaryHistory.mockResolvedValue([]);

      await controller.getSalaryHistory(jobTitle, location, limit);

      expect(mockSalaryService.getSalaryHistory).toHaveBeenCalledWith(jobTitle, location, 6);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const result = await controller.getHealth();

      expect(result).toBeDefined();
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
    });

    it('should return ISO timestamp', async () => {
      const result = await controller.getHealth();

      expect(() => new Date(result.timestamp)).not.toThrow();
    });
  });
});
