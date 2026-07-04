import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExchangeRateService } from './exchange-rate.service';

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
};

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;

  beforeEach(async () => {
    jest.restoreAllMocks();
    mockConfigService.get.mockImplementation((_key: string, defaultValue?: unknown) => defaultValue);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRateService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ExchangeRateService>(ExchangeRateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('converts using the live rate and caches the fetched rate table', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ result: 'success', rates: { ETB: 120, USD: 1 } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const converted = await service.convert(10, 'USD', 'ETB');
    expect(converted).toBe(1200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call within TTL should hit the cache, not fetch again.
    await service.convert(5, 'USD', 'ETB');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns the same amount when converting a currency to itself without fetching', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const converted = await service.convert(42, 'ETB', 'ETB');
    expect(converted).toBe(42);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the static rate table when the live API is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const converted = await service.convert(1, 'USD', 'ETB');
    expect(converted).toBeCloseTo(120.5, 5);
  });

  it('throws BadRequestException when no rate is available anywhere', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    await expect(service.convert(1, 'XXX', 'ETB')).rejects.toThrow(BadRequestException);
  });
});