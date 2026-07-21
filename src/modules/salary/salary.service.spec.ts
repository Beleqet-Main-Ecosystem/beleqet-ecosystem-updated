import { Test, TestingModule } from '@nestjs/testing';
import { SalaryService } from './salary.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrencyService } from './currency/currency.service';
import { CreateSalaryPredictionDto, ExperienceLevel } from './dto/salary-prediction.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SalaryService', () => {
  let service: SalaryService;
  let _prismaService: PrismaService;

  // Mock Currency Service
  const mockCurrencyService = {
    isSupported: jest.fn().mockReturnValue(true),
    convert: jest.fn().mockImplementation((amount) => Math.round(amount)),
    convertSalaryPrediction: jest.fn().mockImplementation((pred) => pred),
  };

  // Mock Prisma Service
  const mockPrismaService = {
    salaryPrediction: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    salaryHistory: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    job: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(mockPrismaService);
      return cb;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CurrencyService,
          useValue: mockCurrencyService,
        },
      ],
    }).compile();

    service = module.get<SalaryService>(SalaryService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('predictSalary', () => {
    it('should predict salary for a valid job position', async () => {
      const dto: CreateSalaryPredictionDto = {
        jobTitle: 'Senior Developer',
        location: 'Addis Ababa',
        experienceLevel: ExperienceLevel.SENIOR,
        industry: 'Technology',
        currency: 'ETB',
      };

      const mockPrediction = {
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
        isAnonymized: true,
      };

      mockPrismaService.salaryPrediction.findFirst.mockResolvedValue(null);
      mockPrismaService.salaryPrediction.create.mockResolvedValue(mockPrediction);
      mockPrismaService.salaryHistory.create.mockResolvedValue(null);

      const result = await service.predictSalary(dto);

      expect(result).toBeDefined();
      expect(result.jobTitle).toBe('Senior Developer');
      expect(result.averageSalary).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(mockPrismaService.salaryPrediction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { lastUpdatedAt: 'desc' } }),
      );
    });

    it('should throw BadRequestException when job title is missing', async () => {
      const dto: Partial<CreateSalaryPredictionDto> = {
        location: 'Addis Ababa',
        experienceLevel: ExperienceLevel.SENIOR,
      };

      await expect(service.predictSalary(dto as CreateSalaryPredictionDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return fresh prediction if exists', async () => {
      const dto: CreateSalaryPredictionDto = {
        jobTitle: 'Developer',
        location: 'Addis Ababa',
        experienceLevel: ExperienceLevel.MID,
        currency: 'ETB',
      };

      const freshPrediction = {
        id: '2',
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
        lastUpdatedAt: new Date(), // Fresh (today)
        createdAt: new Date(),
        isAnonymized: true,
      };

      mockPrismaService.salaryPrediction.findFirst.mockResolvedValue(freshPrediction);

      const result = await service.predictSalary(dto);

      expect(result).toBeDefined();
      expect(mockPrismaService.salaryPrediction.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { lastUpdatedAt: 'desc' } }),
      );
      expect(mockPrismaService.salaryPrediction.create).not.toHaveBeenCalled();
    });
  });

  describe('batchPredict', () => {
    it('should batch predict multiple salaries', async () => {
      const batchDto = {
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

      const mockResult = {
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
      };

      mockPrismaService.salaryPrediction.findFirst.mockResolvedValue(null);
      mockPrismaService.salaryPrediction.create.mockResolvedValue(mockResult);
      mockPrismaService.salaryHistory.create.mockResolvedValue(null);
      mockPrismaService.job.findMany.mockResolvedValue([]);

      const result = await service.batchPredict(batchDto as any);

      expect(result).toBeDefined();
      expect(result.successCount).toBeGreaterThan(0);
      expect(result.predictions).toHaveLength(2);
    });

    it('should throw error for batch size exceeding 50', async () => {
      const largeBatch = {
        predictions: Array.from({ length: 51 }, () => ({
          jobTitle: 'Developer',
          location: 'Addis Ababa',
          experienceLevel: ExperienceLevel.MID,
        })),
      };

      await expect(service.batchPredict(largeBatch as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSalaryStatistics', () => {
    it('should return salary statistics for a location', async () => {
      const mockPredictions = [
        {
          averageSalary: 100000,
          medianSalary: 95000,
        },
        {
          averageSalary: 120000,
          medianSalary: 115000,
        },
      ];

      mockPrismaService.salaryPrediction.findMany.mockResolvedValue(mockPredictions);
      mockPrismaService.salaryHistory.findMany.mockResolvedValue([]);

      const result = await service.getSalaryStatistics('Addis Ababa', undefined, 30, 'ETB');

      expect(result).toBeDefined();
      expect(result.location).toBe('Addis Ababa');
      expect(result.averageSalary).toBeGreaterThan(0);
    });

    it('should throw NotFoundException when no data exists', async () => {
      mockPrismaService.salaryPrediction.findMany.mockResolvedValue([]);

      await expect(
        service.getSalaryStatistics('UnknownLocation', undefined, 30, 'ETB'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSalaryHistory', () => {
    it('should return historical salary data', async () => {
      const mockHistory = [
        {
          jobTitle: 'Developer',
          location: 'Addis Ababa',
          industry: 'Technology',
          experienceLevel: 'MID',
          averageSalary: 70000,
          medianSalary: 68000,
          dataPointsCount: 25,
          currency: 'ETB',
          recordedAt: new Date(),
          isAnonymized: true,
        },
      ];

      mockPrismaService.salaryHistory.findMany.mockResolvedValue(mockHistory);

      const result = await service.getSalaryHistory('Developer', 'Addis Ababa');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].jobTitle).toBe('Developer');
    });

    it('should limit history results', async () => {
      mockPrismaService.salaryHistory.findMany.mockResolvedValue([]);

      await service.getSalaryHistory('Developer', 'Addis Ababa', 5);

      expect(mockPrismaService.salaryHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });
  });

  describe('getPredictions', () => {
    it('should get paginated predictions', async () => {
      const mockPredictions = [
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
      ];

      mockPrismaService.salaryPrediction.findMany.mockResolvedValue(mockPredictions);
      mockPrismaService.salaryPrediction.count.mockResolvedValue(1);

      const result = await service.getPredictions({
        page: 1,
        limit: 20,
      } as any);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should filter predictions by job title', async () => {
      mockPrismaService.salaryPrediction.findMany.mockResolvedValue([]);
      mockPrismaService.salaryPrediction.count.mockResolvedValue(0);

      await service.getPredictions({
        jobTitle: 'Developer',
        page: 1,
        limit: 20,
      } as any);

      expect(mockPrismaService.salaryPrediction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            jobTitle: expect.objectContaining({
              contains: 'Developer',
            }),
          }),
        }),
      );
    });
  });
});
