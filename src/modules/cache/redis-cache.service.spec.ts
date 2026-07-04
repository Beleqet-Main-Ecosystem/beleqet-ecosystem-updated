import { Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisCacheService } from './redis-cache.service';

describe('RedisCacheService', () => {
  let service: RedisCacheService;
  let cache: jest.Mocked<Pick<Cache, 'get' | 'set' | 'del' | 'mdel'>>;

  beforeEach(async () => {
    cache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      mdel: jest.fn(),
    };

    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisCacheService,
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<RedisCacheService>(RedisCacheService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns cached values without calling the loader', async () => {
    cache.get.mockResolvedValueOnce({ id: 'cached-job' });
    const loader = jest.fn<Promise<{ id: string }>, []>();

    await expect(service.getOrSet('jobs:detail:en:1', loader, 60_000)).resolves.toEqual({
      id: 'cached-job',
    });
    expect(loader).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('loads and stores values on cache miss', async () => {
    cache.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]);
    const loader = jest.fn<Promise<{ id: string }>, []>().mockResolvedValue({ id: 'fresh-job' });

    await expect(service.getOrSet('jobs:detail:en:1', loader, 60_000, 'jobs:detail:registry:1')).resolves.toEqual({
      id: 'fresh-job',
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith('jobs:detail:en:1', { id: 'fresh-job' }, 60_000);
    expect(cache.set).toHaveBeenCalledWith('jobs:detail:registry:1', ['jobs:detail:en:1'], 120_000);
  });

  it('falls back to the loader when cache reads fail', async () => {
    cache.get.mockRejectedValueOnce(new Error('redis unavailable'));
    const loader = jest.fn<Promise<{ id: string }>, []>().mockResolvedValue({ id: 'from-db' });

    await expect(service.getOrSet('jobs:detail:en:1', loader, 60_000)).resolves.toEqual({
      id: 'from-db',
    });

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('deletes registered keys and the registry key', async () => {
    cache.get.mockResolvedValueOnce(['jobs:list:a', 'jobs:list:b']);

    await service.invalidateRegisteredKeys('jobs:list:registry');

    expect(cache.mdel).toHaveBeenCalledWith(['jobs:list:a', 'jobs:list:b', 'jobs:list:registry']);
  });
});
