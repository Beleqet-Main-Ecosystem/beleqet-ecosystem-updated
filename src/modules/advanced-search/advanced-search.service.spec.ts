import { Test, TestingModule } from '@nestjs/testing';
import { AdvancedSearchService } from './advanced-search.service';
import { SearchRepository } from './advanced-search.repository';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { InvalidSearchFiltersException } from './exceptions/search.exception';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { calculateRatingFromFeedback, sortSearchResults } from './utils/search-result.utils';
import { SearchResult } from './interfaces/search-repository.interface';

const mockPrismaService = {
  user: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  freelanceJob: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  job: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockI18nService = {
  t: jest.fn((key: string) => {
    const translations: Record<string, string> = {
      'search.invalid_price_range': 'Minimum price must be less than or equal to maximum price',
      'search.invalid_rating': 'Invalid rating. Rating must be between 0 and 5',
      'search.too_many_skills': 'Too many skills selected. Maximum allowed is 20',
      'search.invalid_currency': 'Invalid currency. Supported currencies are ETB, USD, EUR',
      'search.invalid_page': 'Invalid page number. Page must be greater than 0',
      'search.invalid_limit': 'Invalid limit. Limit must be between 1 and 100',
      'search.invalid_rating_value': 'Invalid rating value. Rating must be between 0 and 5',
      'search.invalid_location':
        'Invalid location. Allowed locations are: Addis Ababa, Bahir Dar, Hawassa, Mekelle, Adama, Dire Dawa, Gondar, Jimma, Remote',
    };
    return translations[key] || key;
  }),
};

const mockCacheManager = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
};

describe('AdvancedSearchService', () => {
  let service: AdvancedSearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvancedSearchService,
        SearchRepository,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<AdvancedSearchService>(AdvancedSearchService);
  });

  beforeEach(() => {
    mockPrismaService.user.findMany.mockResolvedValue([]);
    mockPrismaService.user.count.mockResolvedValue(0);
    mockPrismaService.freelanceJob.findMany.mockResolvedValue([]);
    mockPrismaService.freelanceJob.count.mockResolvedValue(0);
    mockPrismaService.job.findMany.mockResolvedValue([]);
    mockPrismaService.job.count.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeSearch', () => {
    it('should search with valid criteria', async () => {
      const criteria = {
        keyword: 'react',
        page: 1,
        limit: 10,
      };

      const result = await service.executeSearch(criteria);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(mockPrismaService.user.findMany).toHaveBeenCalled();
      expect(mockPrismaService.freelanceJob.findMany).toHaveBeenCalled();
      expect(mockPrismaService.job.findMany).toHaveBeenCalled();
    });

    it('should search freelancers only when entityType is freelancer', async () => {
      await service.executeSearch({
        entityType: 'freelancer',
        page: 1,
        limit: 10,
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalled();
      expect(mockPrismaService.freelanceJob.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.job.findMany).not.toHaveBeenCalled();
    });

    it('should validate price range - min > max should throw error', async () => {
      const criteria = {
        minPrice: 5000,
        maxPrice: 1000,
        page: 1,
        limit: 10,
      };

      await expect(service.executeSearch(criteria)).rejects.toThrow(InvalidSearchFiltersException);
    });

    it('should validate rating range - rating > 5 should throw error', async () => {
      const criteria = {
        minRating: 10,
        page: 1,
        limit: 10,
      };

      await expect(service.executeSearch(criteria)).rejects.toThrow(InvalidSearchFiltersException);
    });

    it('should validate skills array - more than 20 skills should throw error', async () => {
      const criteria = {
        skills: Array(21).fill('skill'),
        page: 1,
        limit: 10,
      };

      await expect(service.executeSearch(criteria)).rejects.toThrow(InvalidSearchFiltersException);
    });

    it('should validate currency - invalid currency should throw error', async () => {
      const criteria = {
        currency: 'GBP',
        page: 1,
        limit: 10,
      };

      await expect(service.executeSearch(criteria)).rejects.toThrow(InvalidSearchFiltersException);
    });
  });

  describe('validateFilters', () => {
    it('should pass validation with valid filters', async () => {
      const criteria = {
        minPrice: 100,
        maxPrice: 500,
        minRating: 3,
        skills: ['React', 'Node.js'],
        currency: 'ETB',
        page: 1,
        limit: 20,
      };

      await expect(service.validateFilters(criteria)).resolves.not.toThrow();
    });

    it('should fail validation with invalid price range', async () => {
      const criteria = {
        minPrice: 1000,
        maxPrice: 500,
      };

      await expect(service.validateFilters(criteria)).rejects.toThrow(
        InvalidSearchFiltersException,
      );
    });

    it('should fail validation with invalid rating', async () => {
      const criteria = {
        minRating: 6,
      };

      await expect(service.validateFilters(criteria)).rejects.toThrow(
        InvalidSearchFiltersException,
      );
    });

    it('should fail validation with too many skills', async () => {
      const criteria = {
        skills: Array(21).fill('skill'),
      };

      await expect(service.validateFilters(criteria)).rejects.toThrow(
        InvalidSearchFiltersException,
      );
    });

    it('should fail validation with invalid currency', async () => {
      const criteria = {
        currency: 'GBP',
      };

      await expect(service.validateFilters(criteria)).rejects.toThrow(
        InvalidSearchFiltersException,
      );
    });

    it('should fail validation with invalid page', async () => {
      const criteria = {
        page: 0,
      };

      await expect(service.validateFilters(criteria)).rejects.toThrow(
        InvalidSearchFiltersException,
      );
    });

    it('should fail validation with invalid limit', async () => {
      const criteria = {
        limit: 150,
      };

      await expect(service.validateFilters(criteria)).rejects.toThrow(
        InvalidSearchFiltersException,
      );
    });

    it('should fail validation with invalid location', async () => {
      const criteria = {
        location: 'London',
      };

      await expect(service.validateFilters(criteria)).rejects.toThrow(
        InvalidSearchFiltersException,
      );
    });
  });

  describe('getAvailableFilters', () => {
    it('should return available filters from database skills', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([{ skills: ['React', 'Node.js'] }]);
      mockPrismaService.freelanceJob.findMany.mockResolvedValue([{ skills: ['TypeScript'] }]);
      mockPrismaService.job.findMany.mockResolvedValue([{ tags: ['DevOps'] }]);

      const filters = await service.getAvailableFilters();

      expect(filters.skills).toEqual(['DevOps', 'Node.js', 'React', 'TypeScript']);
      expect(filters.locations).toContain('Addis Ababa');
      expect(filters.currencies).toEqual(['ETB', 'USD', 'EUR']);
      expect(Array.isArray(filters.priceRanges)).toBe(true);
    });
  });

  describe('calculateRating', () => {
    it('should calculate average rating from feedback', () => {
      const feedback = [{ rating: 5 }, { rating: 4 }, { rating: 3 }];
      expect(service.calculateRating(feedback)).toBe(4);
    });

    it('should return 0 for empty feedback', () => {
      expect(service.calculateRating([])).toBe(0);
    });

    it('should return 0 for null feedback', () => {
      expect(service.calculateRating(null)).toBe(0);
    });

    it('should throw error for invalid rating value', () => {
      const feedback = [{ rating: 10 }];
      expect(() => service.calculateRating(feedback)).toThrow();
    });
  });

  describe('search-result.utils', () => {
    const baseResult = (overrides: Partial<SearchResult>): SearchResult => ({
      id: '1',
      type: 'freelancer',
      title: 'Developer',
      skills: [],
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      ...overrides,
    });

    it('should calculate average rating from feedback utility', () => {
      expect(calculateRatingFromFeedback([{ rating: 5 }, { rating: 3 }])).toBe(4);
    });

    it('should sort by rating descending', () => {
      const results = sortSearchResults(
        [baseResult({ id: '1', rating: 2 }), baseResult({ id: '2', rating: 5 })],
        'rating',
      );
      expect(results.map((result) => result.id)).toEqual(['2', '1']);
    });

    it('should sort by relevance when keyword is provided', () => {
      const results = sortSearchResults(
        [
          baseResult({ id: '1', title: 'Backend Developer' }),
          baseResult({ id: '2', title: 'React Developer' }),
        ],
        'relevance',
        'React',
      );
      expect(results[0].id).toBe('2');
    });
  });
});
