import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { prependBoostedIds } from './promotion-merge.util';

describe('CampaignsService status transitions', () => {
  const prisma = {
    campaign: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const service = new CampaignsService(prisma as never, {} as never, {} as never, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it('rejects pause when status is not ACTIVE', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'c1',
      ownerId: 'owner',
      status: 'PAUSED',
    });
    await expect(service.pause('owner', 'c1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects resume when status is not PAUSED', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'c1',
      ownerId: 'owner',
      status: 'ACTIVE',
      spentAmount: 0,
      totalBudget: 100,
      dailySpent: 0,
      dailyBudgetCap: 50,
    });
    await expect(service.resume('owner', 'c1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects resume when total budget is exhausted', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'c1',
      ownerId: 'owner',
      status: 'PAUSED',
      spentAmount: 100,
      totalBudget: 100,
      dailySpent: 0,
      dailyBudgetCap: 50,
    });
    await expect(service.resume('owner', 'c1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects resume when daily cap is spent', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'c1',
      ownerId: 'owner',
      status: 'PAUSED',
      spentAmount: 10,
      totalBudget: 100,
      dailySpent: 50,
      dailyBudgetCap: 50,
    });
    await expect(service.resume('owner', 'c1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('forbids resume by non-owner', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'c1',
      ownerId: 'owner-a',
      status: 'PAUSED',
      spentAmount: 0,
      totalBudget: 100,
      dailySpent: 0,
      dailyBudgetCap: 50,
    });
    await expect(service.resume('owner-b', 'c1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resumes a valid PAUSED campaign', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'c1',
      ownerId: 'owner',
      status: 'PAUSED',
      spentAmount: 10,
      totalBudget: 100,
      dailySpent: 5,
      dailyBudgetCap: 50,
    });
    prisma.campaign.update.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });
    const result = await service.resume('owner', 'c1');
    expect(result.status).toBe('ACTIVE');
  });
});

describe('prependBoostedIds', () => {
  it('places boosted targets first while preserving organic order for the rest', () => {
    const organic = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const merged = prependBoostedIds(organic, ['c', 'a']);
    expect(merged.map((x) => x.id)).toEqual(['c', 'a', 'b', 'd']);
  });
});
