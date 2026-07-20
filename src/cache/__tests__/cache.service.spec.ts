import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache.service';

type MockCacheManager = {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
};

describe('CacheService', () => {
  let service: CacheService;
  let cacheManager: MockCacheManager;

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'redis.prefix') return 'beleqet:';
              if (key === 'security.piiSalt') return 'test-salt';
              if (key === 'redis.debug') return false;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return cached value on hit', async () => {
    const mockData = { id: 1 };
    cacheManager.get.mockResolvedValue(mockData);
    const result = await service.getOrSet('test', async () => ({ id: 2 }));
    expect(result).toEqual(mockData);
  });

  it('should fetch and store on miss', async () => {
    cacheManager.get.mockResolvedValue(undefined);
    const fetchFn = jest.fn().mockResolvedValue({ id: 2 });
    await service.getOrSet('test', fetchFn, { ttl: 60 });
    expect(fetchFn).toHaveBeenCalled();
    expect(cacheManager.set).toHaveBeenCalledWith('beleqet:test', { id: 2 }, 60000);
  });

  it('should fall back on Redis error', async () => {
    cacheManager.get.mockRejectedValue(new Error('timeout'));
    const fetchFn = jest.fn().mockResolvedValue({ id: 3 });
    const result = await service.getOrSet('test', fetchFn);
    expect(result).toEqual({ id: 3 });
  });

  it('should delete cache', async () => {
    await service.del('test');
    expect(cacheManager.del).toHaveBeenCalledWith('beleqet:test');
  });
});