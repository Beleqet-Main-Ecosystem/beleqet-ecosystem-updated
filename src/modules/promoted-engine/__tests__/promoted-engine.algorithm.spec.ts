import {
  remainingDailyBudget,
  remainingTotalBudget,
  isWithinSchedule,
  canServeCampaign,
  computeRankScore,
  nextStatusAfterClick,
  rankCampaigns,
  type CampaignForRanking,
} from '../promoted-engine.algorithm';

const NOW = new Date('2026-08-02T12:00:00Z');

function makeCampaign(overrides: Partial<CampaignForRanking> = {}): CampaignForRanking {
  return {
    status: 'ACTIVE',
    cpcBid: 100,
    dailyBudget: 1000,
    spentToday: 0,
    totalBudget: null,
    spentTotal: 0,
    startAt: new Date('2026-08-01T00:00:00Z'),
    endAt: null,
    ...overrides,
  };
}

describe('remainingDailyBudget', () => {
  it('returns the full budget when nothing has been spent', () => {
    expect(remainingDailyBudget({ dailyBudget: 1000, spentToday: 0 })).toBe(1000);
  });

  it('subtracts spend so far', () => {
    expect(remainingDailyBudget({ dailyBudget: 1000, spentToday: 400 })).toBe(600);
  });

  it('floors at 0 rather than going negative', () => {
    expect(remainingDailyBudget({ dailyBudget: 1000, spentToday: 1500 })).toBe(0);
  });
});

describe('remainingTotalBudget', () => {
  it('returns null when there is no total cap', () => {
    expect(remainingTotalBudget({ totalBudget: null, spentTotal: 500 })).toBeNull();
  });

  it('subtracts lifetime spend from the cap', () => {
    expect(remainingTotalBudget({ totalBudget: 5000, spentTotal: 2000 })).toBe(3000);
  });

  it('floors at 0 rather than going negative', () => {
    expect(remainingTotalBudget({ totalBudget: 5000, spentTotal: 9000 })).toBe(0);
  });
});

describe('isWithinSchedule', () => {
  it('is true with no endAt and a past startAt', () => {
    expect(isWithinSchedule({ startAt: new Date('2026-08-01T00:00:00Z'), endAt: null }, NOW)).toBe(true);
  });

  it('is false before startAt', () => {
    expect(isWithinSchedule({ startAt: new Date('2026-09-01T00:00:00Z'), endAt: null }, NOW)).toBe(false);
  });

  it('is false after endAt', () => {
    expect(
      isWithinSchedule({ startAt: new Date('2026-08-01T00:00:00Z'), endAt: new Date('2026-08-01T12:00:00Z') }, new Date('2026-08-02T00:00:00Z')),
    ).toBe(false);
  });

  it('is true exactly at startAt', () => {
    expect(isWithinSchedule({ startAt: NOW, endAt: null }, NOW)).toBe(true);
  });
});

describe('canServeCampaign', () => {
  it('is true for an ACTIVE, in-schedule campaign with enough budget', () => {
    expect(canServeCampaign(makeCampaign(), NOW)).toBe(true);
  });

  it('is false when not ACTIVE', () => {
    expect(canServeCampaign(makeCampaign({ status: 'PAUSED' }), NOW)).toBe(false);
  });

  it('is false when outside the schedule window', () => {
    expect(canServeCampaign(makeCampaign({ startAt: new Date('2026-09-01T00:00:00Z') }), NOW)).toBe(false);
  });

  it('is false when daily budget cannot cover one more click', () => {
    expect(canServeCampaign(makeCampaign({ dailyBudget: 100, spentToday: 50, cpcBid: 100 }), NOW)).toBe(false);
  });

  it('is false when total budget cannot cover one more click', () => {
    expect(canServeCampaign(makeCampaign({ totalBudget: 150, spentTotal: 100, cpcBid: 100 }), NOW)).toBe(false);
  });

  it('is true at the exact boundary (remaining budget equals cpcBid)', () => {
    expect(canServeCampaign(makeCampaign({ dailyBudget: 100, spentToday: 0, cpcBid: 100 }), NOW)).toBe(true);
  });
});

describe('computeRankScore', () => {
  it('returns cpcBid for a servable campaign', () => {
    expect(computeRankScore(makeCampaign({ cpcBid: 250 }), NOW)).toBe(250);
  });

  it('returns 0 for a non-servable campaign', () => {
    expect(computeRankScore(makeCampaign({ status: 'PAUSED', cpcBid: 250 }), NOW)).toBe(0);
  });
});

describe('nextStatusAfterClick', () => {
  it('stays ACTIVE when budget remains for another click', () => {
    const result = nextStatusAfterClick({
      status: 'ACTIVE',
      cpcBid: 100,
      dailyBudget: 1000,
      spentToday: 300,
      totalBudget: null,
      spentTotal: 300,
    });
    expect(result).toBe('ACTIVE');
  });

  it('moves to EXHAUSTED when daily budget can no longer cover another click', () => {
    const result = nextStatusAfterClick({
      status: 'ACTIVE',
      cpcBid: 100,
      dailyBudget: 1000,
      spentToday: 950,
      totalBudget: null,
      spentTotal: 950,
    });
    expect(result).toBe('EXHAUSTED');
  });

  it('moves to EXHAUSTED when total budget can no longer cover another click', () => {
    const result = nextStatusAfterClick({
      status: 'ACTIVE',
      cpcBid: 100,
      dailyBudget: 10000,
      spentToday: 100,
      totalBudget: 500,
      spentTotal: 450,
    });
    expect(result).toBe('EXHAUSTED');
  });

  it('leaves a non-ACTIVE status untouched', () => {
    const result = nextStatusAfterClick({
      status: 'PAUSED',
      cpcBid: 100,
      dailyBudget: 1000,
      spentToday: 0,
      totalBudget: null,
      spentTotal: 0,
    });
    expect(result).toBe('PAUSED');
  });
});

describe('rankCampaigns', () => {
  it('orders servable campaigns by cpcBid descending', () => {
    const low = makeCampaign({ cpcBid: 50 });
    const high = makeCampaign({ cpcBid: 300 });
    const mid = makeCampaign({ cpcBid: 150 });

    const ranked = rankCampaigns([low, high, mid], NOW);
    expect(ranked.map((c) => c.cpcBid)).toEqual([300, 150, 50]);
  });

  it('ranks non-servable campaigns last regardless of cpcBid', () => {
    const highButPaused = makeCampaign({ cpcBid: 999, status: 'PAUSED' });
    const lowButActive = makeCampaign({ cpcBid: 10 });

    const ranked = rankCampaigns([highButPaused, lowButActive], NOW);
    expect(ranked[0]).toBe(lowButActive);
    expect(ranked[1]).toBe(highButPaused);
  });

  it('breaks ties in score by earlier startAt', () => {
    const older = makeCampaign({ cpcBid: 100, startAt: new Date('2026-07-01T00:00:00Z') });
    const newer = makeCampaign({ cpcBid: 100, startAt: new Date('2026-08-01T00:00:00Z') });

    const ranked = rankCampaigns([newer, older], NOW);
    expect(ranked[0]).toBe(older);
  });

  it('does not mutate the input array', () => {
    const input = [makeCampaign({ cpcBid: 50 }), makeCampaign({ cpcBid: 300 })];
    const original = [...input];
    rankCampaigns(input, NOW);
    expect(input).toEqual(original);
  });
});