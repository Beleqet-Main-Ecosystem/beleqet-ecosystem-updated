import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AdEventType, Campaign, CampaignBidModel } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface ChargeResult {
  charged: boolean;
  campaign: Campaign;
  adEventId?: string;
  cost: number;
  reason?: string;
}

export interface BillableEventInput {
  campaignId: string;
  /** Client IP — hashed before persistence (GDPR). */
  ip?: string;
  /** Raw User-Agent — hashed before persistence (GDPR). */
  userAgent?: string;
  /** Pseudonymous session reference (never a raw user id). */
  sessionRef?: string;
}

/**
 * Tracks campaign spend against daily and total caps with row-level locking
 * so concurrent billable events cannot overspend.
 */
@Injectable()
export class CampaignBudgetService {
  private readonly logger = new Logger(CampaignBudgetService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a billable event and deducts `bidAmount` inside a transaction.
   * CPC bills on CLICK; CPM bills on IMPRESSION. Uses `SELECT … FOR UPDATE`
   * so two concurrent charges that individually fit the remaining budget
   * cannot both succeed when together they would exceed it.
   */
  async chargeBillableEvent(input: BillableEventInput): Promise<ChargeResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "campaigns" WHERE id = ${input.campaignId} FOR UPDATE`;

      const campaign = await tx.campaign.findUnique({ where: { id: input.campaignId } });
      if (!campaign) throw new NotFoundException('Campaign not found');
      if (campaign.status !== 'ACTIVE') {
        return { charged: false, campaign, cost: 0, reason: `status_${campaign.status}` };
      }

      const eventType = billableEventForModel(campaign.bidModel);
      const cost = campaign.bidAmount;
      const nextSpent = campaign.spentAmount + cost;
      const nextDaily = campaign.dailySpent + cost;

      if (nextSpent > campaign.totalBudget || nextDaily > campaign.dailyBudgetCap) {
        const exhausted = await tx.campaign.update({
          where: { id: campaign.id },
          data: { status: 'EXHAUSTED' },
        });
        return {
          charged: false,
          campaign: exhausted,
          cost: 0,
          reason: nextSpent > campaign.totalBudget ? 'total_budget' : 'daily_budget_cap',
        };
      }

      const shouldExhaust =
        nextSpent >= campaign.totalBudget || nextDaily >= campaign.dailyBudgetCap;

      const claimed = await tx.campaign.updateMany({
        where: {
          id: campaign.id,
          status: 'ACTIVE',
          spentAmount: campaign.spentAmount,
          dailySpent: campaign.dailySpent,
        },
        data: {
          spentAmount: { increment: cost },
          dailySpent: { increment: cost },
          ...(shouldExhaust ? { status: 'EXHAUSTED' } : {}),
        },
      });

      if (claimed.count === 0) {
        throw new ConflictException('Concurrent budget update — retry');
      }

      const adEvent = await tx.adEvent.create({
        data: {
          id: randomUUID(),
          campaignId: campaign.id,
          eventType,
          hashedIp: input.ip ? sha256(input.ip) : null,
          hashedUserAgent: input.userAgent ? sha256(input.userAgent) : null,
          sessionRef: input.sessionRef ?? null,
        },
      });

      const updated = await tx.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
      return { charged: true, campaign: updated, adEventId: adEvent.id, cost };
    });
  }

  /**
   * Midnight reset: zeroes `dailySpent` and reactivates campaigns that were
   * exhausted only by the daily cap while total budget remains.
   */
  async resetDailyBudgets(now = new Date()): Promise<number> {
    const reactivated = await this.prisma.$transaction(async (tx) => {
      await tx.campaign.updateMany({
        where: {
          status: { in: ['ACTIVE', 'EXHAUSTED', 'PAUSED'] },
        },
        data: {
          dailySpent: 0,
          dailySpentResetAt: now,
        },
      });

      const candidates = await tx.campaign.findMany({
        where: { status: 'EXHAUSTED' },
      });

      let count = 0;
      for (const c of candidates) {
        if (c.spentAmount < c.totalBudget) {
          await tx.campaign.update({
            where: { id: c.id },
            data: { status: 'ACTIVE' },
          });
          count += 1;
        }
      }
      return count;
    });

    this.logger.log(`Daily budget reset reactivated ${reactivated} campaign(s)`);
    return reactivated;
  }
}

/**
 * Maps bid model to the billable ad event type.
 */
export function billableEventForModel(bidModel: CampaignBidModel): AdEventType {
  return bidModel === 'CPC' ? 'CLICK' : 'IMPRESSION';
}

/**
 * Returns whether a charge of `cost` fits both remaining budgets.
 * Exported for unit tests of the concurrent overspend edge case.
 */
export function fitsBudget(
  campaign: Pick<Campaign, 'spentAmount' | 'dailySpent' | 'totalBudget' | 'dailyBudgetCap'>,
  cost: number,
): boolean {
  return (
    campaign.spentAmount + cost <= campaign.totalBudget &&
    campaign.dailySpent + cost <= campaign.dailyBudgetCap
  );
}

/**
 * Simulates serialized FOR UPDATE charging for two concurrent attempts.
 * The second charge sees the first's committed spend — used in unit tests
 * without a live database.
 */
export function applySerializedCharges(
  initial: Pick<
    Campaign,
    'spentAmount' | 'dailySpent' | 'totalBudget' | 'dailyBudgetCap' | 'bidAmount' | 'status'
  >,
  attempts: number,
): { successes: number; final: typeof initial } {
  let state = { ...initial };
  let successes = 0;
  for (let i = 0; i < attempts; i++) {
    if (state.status !== 'ACTIVE') break;
    const cost = state.bidAmount;
    if (!fitsBudget(state, cost)) {
      state = { ...state, status: 'EXHAUSTED' };
      break;
    }
    const nextSpent = state.spentAmount + cost;
    const nextDaily = state.dailySpent + cost;
    state = {
      ...state,
      spentAmount: nextSpent,
      dailySpent: nextDaily,
      status:
        nextSpent >= state.totalBudget || nextDaily >= state.dailyBudgetCap
          ? 'EXHAUSTED'
          : 'ACTIVE',
    };
    successes += 1;
  }
  return { successes, final: state };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
