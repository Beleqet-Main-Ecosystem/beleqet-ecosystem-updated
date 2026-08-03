import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  canServeCampaign,
  nextStatusAfterClick,
  rankCampaigns,
  type CampaignForRanking,
} from './promoted-engine.algorithm';
import { CreateCampaignDto, SettableCampaignStatusDto } from './dto/promoted-engine.dto';
import { PromotionTargetType } from '@prisma/client';

/** Which wallet type funds a given target's boost — jobs/gigs are bought by
 *  the employer/client posting them; proposal boosts are bought by the
 *  freelancer promoting their own application. */
const WALLET_OWNER_ROLE: Record<PromotionTargetType, 'EMPLOYER' | 'FREELANCER'> = {
  [PromotionTargetType.JOB]: 'EMPLOYER',
  [PromotionTargetType.GIG]: 'EMPLOYER',
  [PromotionTargetType.PROPOSAL]: 'FREELANCER',
};

/**
 * PromotedEngineService — campaign lifecycle, budget/wallet management, and
 * visibility-boost ranking for sponsored jobs, proposals, and gigs.
 *
 * GDPR: PromotionEvent rows carry no PII (see schema comment); this service
 * never reads or writes anything from SearchHistory/KYC/payment-instrument
 * data, so it has no gdprConsent gate to check.
 *
 * i18n: returns raw data only — no user-facing strings originate here.
 *
 * Multi-currency: campaigns are created and charged in the owner's chosen
 * ISO 4217 currency; a campaign's currency must match the funding wallet's
 * currency (both currently default to ETB platform-wide) — cross-currency
 * campaigns are rejected rather than silently converted, since an implicit
 * FX conversion at charge time would make an advertiser's effective CPC
 * drift with exchange rates after they set their bid.
 */
@Injectable()
export class PromotedEngineService {
  private readonly logger = new Logger(PromotedEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new campaign after verifying the caller owns the target
   * entity and has enough wallet balance to fund at least one day's budget.
   * No funds are reserved/locked upfront — spend is debited incrementally
   * per click in `recordClick`, so a campaign can run below its full
   * dailyBudget in wallet balance as long as it can cover each click as it
   * happens.
   */
  async createCampaign(ownerId: string, dto: CreateCampaignDto) {
    if (dto.dailyBudget < dto.cpcBid) {
      throw new BadRequestException('dailyBudget must be at least as large as cpcBid.');
    }
    if (dto.totalBudget != null && dto.totalBudget < dto.cpcBid) {
      throw new BadRequestException('totalBudget must be at least as large as cpcBid.');
    }

    await this.assertOwnsTarget(ownerId, dto.targetType, dto.targetId);

    const currency = dto.currency ?? 'ETB';
    await this.assertSufficientFunds(ownerId, dto.targetType, dto.dailyBudget, currency);

    return this.prisma.promotionCampaign.create({
      data: {
        ownerId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        cpcBid: dto.cpcBid,
        dailyBudget: dto.dailyBudget,
        totalBudget: dto.totalBudget ?? null,
        currency,
        status: 'ACTIVE',
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
    });
  }

  /** Lists campaigns owned by the caller, most recent first. */
  async listMyCampaigns(ownerId: string) {
    return this.prisma.promotionCampaign.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Fetches a single campaign, enforcing owner-or-ADMIN access. */
  async getCampaign(campaignId: string, requesterId: string, requesterRole: string) {
    const campaign = await this.prisma.promotionCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);
    if (requesterRole !== 'ADMIN' && campaign.ownerId !== requesterId) {
      throw new ForbiddenException('You are not authorized to view this campaign.');
    }
    return campaign;
  }

  /**
   * Owner-initiated status change, restricted to ACTIVE/PAUSED/CANCELLED —
   * EXHAUSTED and COMPLETED are system-managed transitions (set by
   * recordClick and the schedule/expiry job respectively) and cannot be
   * set directly here. A CANCELLED campaign cannot be reactivated; a new
   * campaign must be created instead, keeping the audit trail unambiguous.
   */
  async updateStatus(campaignId: string, requesterId: string, requesterRole: string, newStatus: SettableCampaignStatusDto) {
    const campaign = await this.getCampaign(campaignId, requesterId, requesterRole);

    if (campaign.status === 'CANCELLED') {
      throw new BadRequestException('A cancelled campaign cannot be reactivated.');
    }
    if (campaign.status === 'COMPLETED') {
      throw new BadRequestException('A completed campaign cannot be modified.');
    }

    return this.prisma.promotionCampaign.update({
      where: { id: campaignId },
      data: { status: newStatus },
    });
  }

  /**
   * Records an impression or conversion (free, counter-only) or a click
   * (charged). Click charging is the one path that touches money: it's
   * wrapped in a single $transaction so the wallet debit, the campaign's
   * budget counters, the audit transaction row, and the event row all
   * commit atomically or not at all — a crash mid-charge can never leave
   * a campaign's spend counters out of sync with the wallet it drew from.
   */
  async recordEvent(campaignId: string, type: 'IMPRESSION' | 'CLICK' | 'CONVERSION') {
    if (type === 'IMPRESSION') {
      const campaign = await this.prisma.promotionCampaign.update({
        where: { id: campaignId },
        data: { impressions: { increment: 1 } },
      });
      await this.prisma.promotionEvent.create({
        data: { campaignId, type: 'IMPRESSION', costApplied: 0 },
      });
      return campaign;
    }

    if (type === 'CONVERSION') {
      const campaign = await this.prisma.promotionCampaign.update({
        where: { id: campaignId },
        data: { conversions: { increment: 1 } },
      });
      await this.prisma.promotionEvent.create({
        data: { campaignId, type: 'CONVERSION', costApplied: 0 },
      });
      return campaign;
    }

    return this.recordClick(campaignId);
  }

  private async recordClick(campaignId: string) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.promotionCampaign.findUnique({ where: { id: campaignId } });
      if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);

      const forRanking: CampaignForRanking = {
        status: campaign.status,
        cpcBid: campaign.cpcBid,
        dailyBudget: campaign.dailyBudget,
        spentToday: campaign.spentToday,
        totalBudget: campaign.totalBudget,
        spentTotal: campaign.spentTotal,
        startAt: campaign.startAt,
        endAt: campaign.endAt,
      };

      if (!canServeCampaign(forRanking, new Date())) {
        // Campaign can no longer afford/serve a click — record the
        // impression-equivalent attempt as a zero-cost click for analytics
        // visibility, but don't charge or increment spend.
        this.logger.warn(`Click ignored for non-servable campaign ${campaignId}`);
        return campaign;
      }

      await this.debitOwnerWallet(tx, campaign.ownerId, campaign.targetType, campaign.cpcBid, campaign.currency, campaignId);

      const updated = await tx.promotionCampaign.update({
        where: { id: campaignId },
        data: {
          spentToday: { increment: campaign.cpcBid },
          spentTotal: { increment: campaign.cpcBid },
          clicks: { increment: 1 },
        },
      });

      const newStatus = nextStatusAfterClick({
        status: updated.status,
        cpcBid: updated.cpcBid,
        dailyBudget: updated.dailyBudget,
        spentToday: updated.spentToday,
        totalBudget: updated.totalBudget,
        spentTotal: updated.spentTotal,
      });

      const final =
        newStatus === updated.status
          ? updated
          : await tx.promotionCampaign.update({ where: { id: campaignId }, data: { status: newStatus } });

      await tx.promotionEvent.create({
        data: { campaignId, type: 'CLICK', costApplied: campaign.cpcBid },
      });

      return final;
    });
  }

  /** Returns aggregate performance stats for a single campaign. */
  async getAnalytics(campaignId: string, requesterId: string, requesterRole: string) {
    const campaign = await this.getCampaign(campaignId, requesterId, requesterRole);

    return {
      campaignId: campaign.id,
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      conversions: campaign.conversions,
      ctr: campaign.impressions === 0 ? 0 : campaign.clicks / campaign.impressions,
      spentTotal: campaign.spentTotal,
      spentToday: campaign.spentToday,
      currency: campaign.currency,
      status: campaign.status,
    };
  }

  /**
   * For a batch of targets of the same type, returns which ones currently
   * have a winning (top-ranked) active campaign, and at what rank. Used by
   * search/listing pages to decide boosted placement. Deliberately does
   * NOT return cpcBid or any other campaign's bid amount — that would leak
   * competitors' bidding strategy to anyone browsing the public job board.
   */
  async getActiveBoosts(targetType: PromotionTargetType, targetIds: string[]) {
    const now = new Date();
    const campaigns = await this.prisma.promotionCampaign.findMany({
      where: { targetType, targetId: { in: targetIds }, status: 'ACTIVE' },
    });

    const byTarget = new Map<string, CampaignForRanking[]>();
    for (const campaign of campaigns) {
      const list = byTarget.get(campaign.targetId) ?? [];
      list.push({
        status: campaign.status,
        cpcBid: campaign.cpcBid,
        dailyBudget: campaign.dailyBudget,
        spentToday: campaign.spentToday,
        totalBudget: campaign.totalBudget,
        spentTotal: campaign.spentTotal,
        startAt: campaign.startAt,
        endAt: campaign.endAt,
      });
      byTarget.set(campaign.targetId, list);
    }

    return targetIds.map((targetId) => {
      const candidates = byTarget.get(targetId) ?? [];
      const ranked = rankCampaigns(candidates, now);
      const isBoosted = ranked.length > 0 && ranked[0].cpcBid > 0 && canServeCampaign(ranked[0], now);
      return { targetId, isBoosted };
    });
  }

  /**
   * Verifies the caller owns the entity they're trying to promote.
   * Ownership fields differ per target type — Job is owned via its
   * Company (Company.userId), FreelanceJob via clientId directly, and
   * Application (a proposal) via its own userId (the applicant).
   */
  private async assertOwnsTarget(ownerId: string, targetType: PromotionTargetType, targetId: string): Promise<void> {
    if (targetType === PromotionTargetType.JOB) {
      const job = await this.prisma.job.findUnique({ where: { id: targetId }, include: { company: true } });
      if (!job) throw new NotFoundException(`Job ${targetId} not found`);
      if (job.company.userId !== ownerId) {
        throw new ForbiddenException('You do not own this job posting.');
      }
      return;
    }

    if (targetType === PromotionTargetType.GIG) {
      const gig = await this.prisma.freelanceJob.findUnique({ where: { id: targetId } });
      if (!gig) throw new NotFoundException(`Freelance job ${targetId} not found`);
      if (gig.clientId !== ownerId) {
        throw new ForbiddenException('You do not own this gig.');
      }
      return;
    }

    // PROPOSAL
    const application = await this.prisma.application.findUnique({ where: { id: targetId } });
    if (!application) throw new NotFoundException(`Application ${targetId} not found`);
    if (application.userId !== ownerId) {
      throw new ForbiddenException('You do not own this proposal.');
    }
  }

  /** Throws if the owner's funding wallet can't currently cover `amount`. */
  private async assertSufficientFunds(ownerId: string, targetType: PromotionTargetType, amount: number, currency: string): Promise<void> {
    const walletRole = WALLET_OWNER_ROLE[targetType];

    if (walletRole === 'EMPLOYER') {
      const wallet = await this.prisma.employerWallet.findUnique({ where: { userId: ownerId } });
      if (!wallet || wallet.currency !== currency || wallet.balance < amount) {
        throw new BadRequestException('Insufficient employer wallet balance to fund this campaign.');
      }
      return;
    }

    const wallet = await this.prisma.freelancerWallet.findUnique({ where: { userId: ownerId } });
    if (!wallet || wallet.currency !== currency || wallet.availableBalance < amount) {
      throw new BadRequestException('Insufficient freelancer wallet balance to fund this campaign.');
    }
  }

  /**
   * Debits `amount` from the owner's funding wallet within an existing
   * transaction, and records a PromotionWalletTransaction audit row.
   * Uses a conditional `updateMany` (balance >= amount in the WHERE
   * clause) rather than a plain `update` so a race between two concurrent
   * clicks can never drive a wallet balance negative — if the guarded
   * update matches zero rows, funds were insufficient at the moment of
   * charge and the whole click transaction rolls back.
   */
  private async debitOwnerWallet(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    ownerId: string,
    targetType: PromotionTargetType,
    amount: number,
    currency: string,
    campaignId: string,
  ): Promise<void> {
    const walletRole = WALLET_OWNER_ROLE[targetType];

    if (walletRole === 'EMPLOYER') {
      const result = await tx.employerWallet.updateMany({
        where: { userId: ownerId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (result.count === 0) {
        throw new BadRequestException('Insufficient employer wallet balance for this click.');
      }
    } else {
      const result = await tx.freelancerWallet.updateMany({
        where: { userId: ownerId, availableBalance: { gte: amount } },
        data: { availableBalance: { decrement: amount } },
      });
      if (result.count === 0) {
        throw new BadRequestException('Insufficient freelancer wallet balance for this click.');
      }
    }

    await tx.promotionWalletTransaction.create({
      data: { campaignId, amount, currency, note: 'CPC click charge' },
    });
  }
}