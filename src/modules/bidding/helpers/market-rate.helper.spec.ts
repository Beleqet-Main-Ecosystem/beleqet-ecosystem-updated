import { MarketRateHelper } from './market-rate.helper';

describe('MarketRateHelper', () => {
  const mockPrisma: any = {
    contract: { aggregate: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null rate and zero count when no contracts exist (cold start)', async () => {
    mockPrisma.contract.aggregate.mockResolvedValue({
      _avg: { agreedAmount: null },
      _count: 0,
    });
    const result = await MarketRateHelper.computeRate(mockPrisma, 'cat-new');
    expect(result.averageRate).toBeNull();
    expect(result.contractCount).toBe(0);
  });

  it('returns average and count of completed contracts', async () => {
    mockPrisma.contract.aggregate.mockResolvedValue({
      _avg: { agreedAmount: 16000 },
      _count: 3,
    });
    const result = await MarketRateHelper.computeRate(mockPrisma, 'cat-123');
    expect(result.averageRate).toBe(16000);
    expect(result.contractCount).toBe(3);
  });

  it('rounds the average to nearest integer', async () => {
    mockPrisma.contract.aggregate.mockResolvedValue({
      _avg: { agreedAmount: 10000.6 },
      _count: 2,
    });
    const result = await MarketRateHelper.computeRate(mockPrisma, 'cat-456');
    expect(result.averageRate).toBe(10001);
    expect(result.contractCount).toBe(2);
  });
});
