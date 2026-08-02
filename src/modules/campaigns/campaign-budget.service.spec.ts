import { applySerializedCharges, fitsBudget } from './campaign-budget.service';
import { CampaignAuctionService } from './campaign-auction.service';

describe('CampaignBudgetService race safety', () => {
  it('fitsBudget rejects a charge that would exceed the daily cap', () => {
    expect(
      fitsBudget(
        { spentAmount: 0, dailySpent: 80, totalBudget: 1000, dailyBudgetCap: 100 },
        30,
      ),
    ).toBe(false);
  });

  it('serializes two concurrent clicks that individually fit but together exceed the cap', () => {
    // Remaining daily headroom is 100; each click costs 75 — only one may succeed.
    const { successes, final } = applySerializedCharges(
      {
        spentAmount: 0,
        dailySpent: 0,
        totalBudget: 10_000,
        dailyBudgetCap: 100,
        bidAmount: 75,
        status: 'ACTIVE',
      },
      2,
    );

    expect(successes).toBe(1);
    expect(final.dailySpent).toBe(75);
    expect(final.spentAmount).toBe(75);
    // Second attempt finds insufficient room and marks exhausted.
    expect(final.status).toBe('EXHAUSTED');
  });

  it('allows both charges when they fit under the remaining cap together', () => {
    const { successes, final } = applySerializedCharges(
      {
        spentAmount: 0,
        dailySpent: 0,
        totalBudget: 10_000,
        dailyBudgetCap: 200,
        bidAmount: 75,
        status: 'ACTIVE',
      },
      2,
    );

    expect(successes).toBe(2);
    expect(final.dailySpent).toBe(150);
    expect(final.status).toBe('ACTIVE');
  });
});

describe('CampaignAuctionService tie-break', () => {
  const auction = new CampaignAuctionService({} as never, {} as never, {} as never);

  it('scores as bid_amount * quality_score', () => {
    const ranked = auction.rankCampaigns(
      [
        {
          id: 'a',
          targetType: 'JOB',
          targetId: 'j1',
          bidModel: 'CPC',
          bidAmount: 10,
          createdAt: new Date('2026-01-01'),
          qualityScore: 50,
        },
        {
          id: 'b',
          targetType: 'JOB',
          targetId: 'j2',
          bidModel: 'CPC',
          bidAmount: 20,
          createdAt: new Date('2026-01-01'),
          qualityScore: 40,
        },
      ],
      10,
    );

    expect(ranked[0].campaignId).toBe('b'); // 800 > 500
    expect(ranked[0].score).toBe(800);
  });

  it('breaks ties by newer createdAt (deterministic)', () => {
    const ranked = auction.rankCampaigns(
      [
        {
          id: 'older',
          targetType: 'JOB',
          targetId: 'j1',
          bidModel: 'CPC',
          bidAmount: 10,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          qualityScore: 50,
        },
        {
          id: 'newer',
          targetType: 'JOB',
          targetId: 'j2',
          bidModel: 'CPC',
          bidAmount: 10,
          createdAt: new Date('2026-06-01T00:00:00Z'),
          qualityScore: 50,
        },
      ],
      10,
    );

    expect(ranked[0].campaignId).toBe('newer');
    expect(ranked[1].campaignId).toBe('older');
  });
});
