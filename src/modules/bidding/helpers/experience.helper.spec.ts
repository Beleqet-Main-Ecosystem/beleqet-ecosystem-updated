import { ExperienceHelper } from './experience.helper';

describe('ExperienceHelper', () => {
  const mockPrisma: any = {
    contract: { count: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0.9x multiplier for novice freelancer (0 contracts)', async () => {
    mockPrisma.contract.count.mockResolvedValue(0);
    const result = await ExperienceHelper.computeMultiplier(
      mockPrisma,
      'freelancer-novice',
    );
    expect(result).toBe(0.9);
  });

  it('returns 1.0x multiplier for intermediate freelancer (1-4 contracts)', async () => {
    mockPrisma.contract.count.mockResolvedValue(3);
    const result = await ExperienceHelper.computeMultiplier(
      mockPrisma,
      'freelancer-intermediate',
    );
    expect(result).toBe(1.0);
  });

  it('returns 1.1x multiplier for experienced freelancer (5+ contracts)', async () => {
    mockPrisma.contract.count.mockResolvedValue(7);
    const result = await ExperienceHelper.computeMultiplier(
      mockPrisma,
      'freelancer-expert',
    );
    expect(result).toBe(1.1);
  });
});
