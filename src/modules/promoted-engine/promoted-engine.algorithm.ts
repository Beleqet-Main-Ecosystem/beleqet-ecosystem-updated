/**
 * promoted-engine.algorithm.ts
 *
 * Pure functions for the Promoted Engine's visibility ranking and budget
 * bookkeeping. Deliberately kept free of NestJS/Prisma dependencies so the
 * logic can be unit tested in isolation from the database layer (see
 * promoted-engine.algorithm.spec.ts).
 *
 * Ranking model: highest-bid-wins among campaigns that can currently afford
 * to serve (first-price auction). This is intentionally simple for a first
 * version — a second-price ("pay just above the next-highest bidder")
 * auction is a common follow-up refinement once there's real bidding volume
 * to tune against, but first-price is simpler to reason about, test, and
 * explain to advertisers at launch.
 */

/** Minimal shape of a campaign needed for ranking/budget decisions. */
export interface CampaignForRanking {
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'EXHAUSTED' | 'COMPLETED' | 'CANCELLED';
  cpcBid: number;
  dailyBudget: number;
  spentToday: number;
  totalBudget: number | null;
  spentTotal: number;
  startAt: Date;
  endAt: Date | null;
}

/** Budget remaining today, floored at 0 (never negative). */
export function remainingDailyBudget(
  campaign: Pick<CampaignForRanking, 'dailyBudget' | 'spentToday'>,
): number {
  return Math.max(0, campaign.dailyBudget - campaign.spentToday);
}

/**
 * Lifetime budget remaining, floored at 0. Returns null when the campaign
 * has no total cap (only bounded by dailyBudget), matching the nullable
 * `totalBudget` field on the schema.
 */
export function remainingTotalBudget(
  campaign: Pick<CampaignForRanking, 'totalBudget' | 'spentTotal'>,
): number | null {
  if (campaign.totalBudget == null) return null;
  return Math.max(0, campaign.totalBudget - campaign.spentTotal);
}

/** Whether `now` falls within the campaign's [startAt, endAt] window (endAt null = no end date). */
export function isWithinSchedule(
  campaign: Pick<CampaignForRanking, 'startAt' | 'endAt'>,
  now: Date,
): boolean {
  if (now < campaign.startAt) return false;
  if (campaign.endAt && now > campaign.endAt) return false;
  return true;
}

/**
 * Whether the campaign is eligible to serve (be shown boosted, incur a
 * click charge) right now: must be ACTIVE, within its schedule window, and
 * have enough remaining daily *and* total budget to cover one more click
 * at its current cpcBid.
 */
export function canServeCampaign(campaign: CampaignForRanking, now: Date): boolean {
  if (campaign.status !== 'ACTIVE') return false;
  if (!isWithinSchedule(campaign, now)) return false;
  if (remainingDailyBudget(campaign) < campaign.cpcBid) return false;

  const totalRemaining = remainingTotalBudget(campaign);
  if (totalRemaining !== null && totalRemaining < campaign.cpcBid) return false;

  return true;
}

/**
 * Ranking score for ordering candidates in a boosted position. Servable
 * campaigns rank by their CPC bid (highest first); anything not currently
 * servable ranks at 0, same as an unboosted/organic listing — so a paused
 * or exhausted campaign never outranks organic content it's no longer
 * actively paying for.
 */
export function computeRankScore(campaign: CampaignForRanking, now: Date): number {
  return canServeCampaign(campaign, now) ? campaign.cpcBid : 0;
}

/**
 * Determines the campaign's status immediately after a click charge is
 * applied (spentToday/spentTotal already incremented by cpcBid by the
 * caller before this is checked). Transitions ACTIVE -> EXHAUSTED once
 * there's no longer enough remaining budget (daily or total) to cover
 * another click at the same bid; otherwise the campaign stays ACTIVE.
 *
 * Only ever moves a campaign *into* EXHAUSTED here — callers are
 * responsible for the separate daily-reset job that moves EXHAUSTED
 * (due to dailyBudget only) campaigns back to ACTIVE at the next day
 * boundary; a campaign exhausted by totalBudget should never be revived.
 */
export function nextStatusAfterClick(
  campaignAfterCharge: Pick<
    CampaignForRanking,
    'status' | 'cpcBid' | 'dailyBudget' | 'spentToday' | 'totalBudget' | 'spentTotal'
  >,
): CampaignForRanking['status'] {
  if (campaignAfterCharge.status !== 'ACTIVE') return campaignAfterCharge.status;

  const dailyRemaining = remainingDailyBudget(campaignAfterCharge);
  const totalRemaining = remainingTotalBudget(campaignAfterCharge);

  const dailyExhausted = dailyRemaining < campaignAfterCharge.cpcBid;
  const totalExhausted = totalRemaining !== null && totalRemaining < campaignAfterCharge.cpcBid;

  return dailyExhausted || totalExhausted ? 'EXHAUSTED' : 'ACTIVE';
}

/**
 * Sorts a set of candidate campaigns for the same target-slot by rank score
 * (descending). Ties are broken by earlier `startAt` (the campaign that's
 * been running longer wins ties) so ordering is deterministic rather than
 * dependent on array/query order.
 */
export function rankCampaigns(campaigns: CampaignForRanking[], now: Date): CampaignForRanking[] {
  return [...campaigns].sort((a, b) => {
    const scoreDiff = computeRankScore(b, now) - computeRankScore(a, now);
    if (scoreDiff !== 0) return scoreDiff;
    return a.startAt.getTime() - b.startAt.getTime();
  });
}
