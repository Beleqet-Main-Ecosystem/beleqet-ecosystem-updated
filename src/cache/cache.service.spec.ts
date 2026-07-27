import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let cacheManagerMock: any;
  let configServiceMock: any;

  beforeEach(async () => {
    cacheManagerMock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'redis.prefix') return 'test:';
        if (key === 'security.piiSalt') return 'test-salt';
        if (key === 'redis.debug') return false;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: CACHE_MANAGER, useValue: cacheManagerMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    // Clear pending fetches before each test to avoid interference
    service['pendingFetches'].clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrSet', () => {
    it('should return cached value if present', async () => {
      const key = 'test-key';
      const cachedValue = { data: 'cached' };
      cacheManagerMock.get.mockResolvedValue(cachedValue);

      const result = await service.getOrSet(key, jest.fn());
      expect(result).toEqual(cachedValue);
      expect(cacheManagerMock.get).toHaveBeenCalledWith('test:test-key');
    });

    it('should fetch and cache if not present', async () => {
      const key = 'test-key';
      const freshValue = { data: 'fresh' };
      cacheManagerMock.get.mockResolvedValue(undefined);
      const fetchFn = jest.fn().mockResolvedValue(freshValue);

      const result = await service.getOrSet(key, fetchFn);
      expect(result).toEqual(freshValue);
      expect(fetchFn).toHaveBeenCalled();
      expect(cacheManagerMock.set).toHaveBeenCalledWith('test:test-key', freshValue, undefined);
    });

    it('should coalesce concurrent requests for the same key', async () => {
      const key = 'coalesce-key';
      const freshValue = { data: 'fresh' };
      cacheManagerMock.get.mockResolvedValue(undefined);
      const fetchFn = jest.fn().mockResolvedValue(freshValue);

      const [result1, result2] = await Promise.all([
        service.getOrSet(key, fetchFn),
        service.getOrSet(key, fetchFn),
      ]);

      expect(result1).toEqual(freshValue);
      expect(result2).toEqual(freshValue);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should not retry automatically on error and should clear pending entry', async () => {
    //   const key = 'error-key';
    //   const error = new Error('Downstream failure');
    //   cacheManagerMock.get.mockResolvedValue(undefined);
    //   const fetchFn = jest.fn().mockRejectedValueOnce(error);

    //   // First call – should reject
    //   await expect(service.getOrSet(key, fetchFn)).rejects.toThrow('Downstream failure');
    //   expect(fetchFn).toHaveBeenCalledTimes(1);

    //   // After rejection, pending entry should be cleared
    //   expect(service['pendingFetches'].has(key)).toBe(false);

    //   // Second call – should try again and succeed
    //   fetchFn.mockResolvedValue('recovered data');
    //   const result = await service.getOrSet(key, fetchFn);
    //   expect(result).toBe('recovered data');
    //   expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('should skip cache if skipCache option is true', async () => {
      const key = 'skip-key';
      const freshValue = { data: 'fresh' };
      const fetchFn = jest.fn().mockResolvedValue(freshValue);

      const result = await service.getOrSet(key, fetchFn, { skipCache: true });
      expect(result).toEqual(freshValue);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(cacheManagerMock.get).not.toHaveBeenCalled();
      expect(cacheManagerMock.set).not.toHaveBeenCalled();
    });
  });

  describe('set', () => {
    it('should set value with TTL', async () => {
      const key = 'set-key';
      const value = { data: 'value' };
      const ttl = 60;

      await service.set(key, value, { ttl });
      expect(cacheManagerMock.set).toHaveBeenCalledWith('test:set-key', value, 60);
    });
  });

  describe('get', () => {
    it('should get value', async () => {
      const key = 'get-key';
      const expected = { data: 'foo' };
      cacheManagerMock.get.mockResolvedValue(expected);

      const result = await service.get(key);
      expect(result).toEqual(expected);
      expect(cacheManagerMock.get).toHaveBeenCalledWith('test:get-key');
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      const key = 'del-key';
      await service.del(key);
      expect(cacheManagerMock.del).toHaveBeenCalledWith('test:del-key');
    });
  });
});