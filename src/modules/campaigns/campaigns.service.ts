import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, CampaignTargetType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignAuctionService, RankedCampaign } from './campaign-auction.service';
import { CampaignBudgetService } from './campaign-budget.service';
import { CampaignPaymentService } from './campaign-payment.service';

/**
 * Owner-facing campaign CRUD, pause/resume, and metrics aggregation.
 */
@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: CampaignPaymentService,
    private readonly budget: CampaignBudgetService,
    private readonly auction: CampaignAuctionService,
  ) {}

  /**
   * Creates a campaign in DRAFT then immediately reserves budget (wallet/Chapa).
   * Status becomes ACTIVE when fully authorized, else PENDING_PAYMENT.
   */
  async create(ownerId: string, dto: CreateCampaignDto, ownerEmail: string) {
    if (dto.dailyBudgetCap > dto.totalBudget) {
      throw new BadRequestException('dailyBudgetCap cannot exceed totalBudget');
    }
    if (dto.startAt && dto.endAt && new Date(dto.endAt) <= new Date(dto.startAt)) {
      throw new BadRequestException('endAt must be after startAt');
    }

    await this.assertTargetExists(dto.targetType, dto.targetId);

    const campaign = await this.prisma.campaign.create({
      data: {
        ownerId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        status: 'DRAFT',
        bidModel: dto.bidModel,
        bidAmount: dto.bidAmount,
        dailyBudgetCap: dto.dailyBudgetCap,
        totalBudget: dto.totalBudget,
        currencyCode: (dto.currencyCode ?? 'ETB').toUpperCase(),
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
    });

    const reservation = await this.payments.reserveBudget(campaign.id, ownerEmail);
    return reservation;
  }

  /**
   * Owner-scoped list with optional status filter.
   */
  async listForOwner(ownerId: string, status?: string) {
    return this.prisma.campaign.findMany({
      where: {
        ownerId,
        ...(status ? { status: status as CampaignStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Aggregated metrics for dashboards (impressions/clicks/conversions + spend).
   */
  async getMetrics(ownerId: string, campaignId: string) {
    const campaign = await this.requireOwned(ownerId, campaignId);

    const grouped = await this.prisma.adEvent.groupBy({
      by: ['eventType'],
      where: { campaignId },
      _count: { _all: true },
    });

    const counts = {
      IMPRESSION: 0,
      CLICK: 0,
      CONVERSION: 0,
    };
    for (const row of grouped) {
      counts[row.eventType] = row._count._all;
    }

    const impressions = counts.IMPRESSION;
    const clicks = counts.CLICK;
    const ctr = impressions > 0 ? clicks / impressions : 0;

    return {
      campaignId: campaign.id,
      status: campaign.status,
      bidModel: campaign.bidModel,
      currencyCode: campaign.currencyCode,
      fxRate: campaign.fxRate,
      fxFromCurrency: campaign.fxFromCurrency,
      fxToCurrency: campaign.fxToCurrency,
      spentAmount: campaign.spentAmount,
      dailySpent: campaign.dailySpent,
      dailyBudgetCap: campaign.dailyBudgetCap,
      totalBudget: campaign.totalBudget,
      impressions,
      clicks,
      conversions: counts.CONVERSION,
      ctr,
    };
  }

  /**
   * Pauses an ACTIVE campaign owned by the caller.
   */
  async pause(ownerId: string, campaignId: string) {
    const campaign = await this.requireOwned(ownerId, campaignId);
    if (campaign.status !== 'ACTIVE') {
      throw new BadRequestException('Only ACTIVE campaigns can be paused');
    }
    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });
  }

  /**
   * Resumes a PAUSED campaign when budget remains.
   */
  async resume(ownerId: string, campaignId: string) {
    const campaign = await this.requireOwned(ownerId, campaignId);
    if (campaign.status !== 'PAUSED') {
      throw new BadRequestException('Only PAUSED campaigns can be resumed');
    }
    if (campaign.spentAmount >= campaign.totalBudget) {
      throw new BadRequestException('Campaign total budget is exhausted');
    }
    if (campaign.dailySpent >= campaign.dailyBudgetCap) {
      throw new BadRequestException('Daily budget cap reached — wait for daily reset');
    }
    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'ACTIVE' },
    });
  }

  /**
   * Auction ranking entry point (reuses AI-feed quality scores + cache).
   */
  rank(query: string, targetType?: CampaignTargetType, limit?: number): Promise<RankedCampaign[]> {
    return this.auction.rankForQuery(query, { targetType, limit });
  }

  /**
   * Exposes budget charging for ad delivery pipelines.
   */
  chargeBillableEvent(
    campaignId: string,
    meta: { ip?: string; userAgent?: string; sessionRef?: string },
  ) {
    return this.budget.chargeBillableEvent({ campaignId, ...meta });
  }

  private async requireOwned(ownerId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this campaign');
    }
    return campaign;
  }

  private async assertTargetExists(targetType: CampaignTargetType, targetId: string) {
    if (targetType === 'JOB') {
      const job = await this.prisma.job.findUnique({ where: { id: targetId } });
      if (!job) throw new BadRequestException('targetId does not match a job');
      return;
    }
    if (targetType === 'GIG') {
      const gig = await this.prisma.freelanceJob.findUnique({ where: { id: targetId } });
      if (!gig) throw new BadRequestException('targetId does not match a gig');
      return;
    }
    const bid = await this.prisma.bid.findUnique({ where: { id: targetId } });
    if (!bid) throw new BadRequestException('targetId does not match a proposal (bid)');
  }
}
