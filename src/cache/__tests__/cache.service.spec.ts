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

  describe('getOrSet', () => {
    it('should return cached value on hit', async () => {
      const mockData = { id: 1, name: 'Test' };
      cacheManager.get.mockResolvedValue(mockData);

      const result = await service.getOrSet('test', async () => ({ id: 2 }));

      expect(result).toEqual(mockData);
      expect(cacheManager.get).toHaveBeenCalledWith('beleqet:test');
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should fetch and store on miss', async () => {
      cacheManager.get.mockResolvedValue(undefined);
      const fetchFn = jest.fn().mockResolvedValue({ id: 2 });

      await service.getOrSet('test', fetchFn, { ttl: 60 });

      expect(fetchFn).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalledWith(
        'beleqet:test',
        { id: 2 },
        60000,
      );
    });

    it('should fall back on Redis error', async () => {
      cacheManager.get.mockRejectedValue(new Error('Redis timeout'));
      const fetchFn = jest.fn().mockResolvedValue({ id: 3 });

      const result = await service.getOrSet('test', fetchFn);

      expect(fetchFn).toHaveBeenCalled();
      expect(result).toEqual({ id: 3 });
    });
  });

  describe('set', () => {
    it('should store value with TTL in milliseconds', async () => {
      await service.set('test', { data: 'value' }, { ttl: 30 });

      expect(cacheManager.set).toHaveBeenCalledWith(
        'beleqet:test',
        { data: 'value' },
        30000,
      );
    });

    it('should store value without TTL', async () => {
      await service.set('test', { data: 'value' });

      expect(cacheManager.set).toHaveBeenCalledWith(
        'beleqet:test',
        { data: 'value' },
        undefined,
      );
    });
  });

  describe('get', () => {
    it('should retrieve value from cache', async () => {
      const mockData = { id: 1 };
      cacheManager.get.mockResolvedValue(mockData);

      const result = await service.get('test');

      expect(result).toEqual(mockData);
      expect(cacheManager.get).toHaveBeenCalledWith('beleqet:test');
    });

    it('should return undefined for missing key', async () => {
      cacheManager.get.mockResolvedValue(undefined);

      const result = await service.get('test');

      expect(result).toBeUndefined();
    });
  });

  describe('del', () => {
    it('should delete cache entry', async () => {
      await service.del('test');

      expect(cacheManager.del).toHaveBeenCalledWith('beleqet:test');
    });

    it('should delete cache entry with namespace', async () => {
      await service.del('test', 'product');

      expect(cacheManager.del).toHaveBeenCalledWith('beleqet:product:test');
    });
  });

  describe('hashPii', () => {
    it('should consistently hash a value to 32 characters', () => {
      const hash1 = service.hashPii('user@email.com');
      const hash2 = service.hashPii('user@email.com');

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(32);
      expect(hash1).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should produce different hashes for different values', () => {
      const hash1 = service.hashPii('user1');
      const hash2 = service.hashPii('user2');

      expect(hash1).not.toBe(hash2);
    });

    it('should be deterministic (same input = same output)', () => {
      const hash1 = service.hashPii('test@example.com');
      const hash2 = service.hashPii('test@example.com');

      expect(hash1).toBe(hash2);
    });
  });

  describe('buildKey', () => {
    it('should add prefix to key', () => {
      const key = service.buildKey('abc');

      expect(key).toBe('beleqet:abc');
    });

    it('should add prefix and namespace', () => {
      const key = service.buildKey('abc', 'product');

      expect(key).toBe('beleqet:product:abc');
    });

    it('should hash PII when requested', () => {
      const hashed = service.buildKey('sensitive-id', undefined, true);

      expect(hashed).toMatch(/^beleqet:[a-f0-9]{32}$/);
      expect(hashed).toHaveLength(8 + 32);
    });

    it('should hash PII with namespace when requested', () => {
      const hashed = service.buildKey('sensitive-id', 'user', true);

      expect(hashed).toMatch(/^beleqet:user:[a-f0-9]{32}$/);
    });
  });
});