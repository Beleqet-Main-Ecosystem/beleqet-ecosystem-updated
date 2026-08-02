import { Injectable, Logger } from '@nestjs/common';
import { Campaign, CampaignBidModel, CampaignTargetType } from '@prisma/client';
import { createHash } from 'crypto';
import { CacheService } from '../../cache/cache.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiFeedService } from '../ai-feed/ai-feed.service';

/** Short TTL so rankings stay fresh without recomputing every search hit. */
export const CAMPAIGN_RANKING_CACHE_TTL_SECONDS = 45;

export interface RankedCampaign {
  campaignId: string;
  targetType: CampaignTargetType;
  targetId: string;
  bidModel: CampaignBidModel;
  bidAmount: number;
  qualityScore: number;
  /** `bid_amount * quality_score` — primary auction sort key. */
  score: number;
  createdAt: string;
}

/**
 * Auction/ranking for boost campaigns.
 * score = bid_amount * quality_score, where quality_score reuses the AI-feed
 * relevance signal (not a new metric). Ties break to the newer campaign.
 */
@Injectable()
export class CampaignAuctionService {
  private readonly logger = new Logger(CampaignAuctionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiFeed: AiFeedService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Ranks active campaigns for a search query, caching the ordered result.
   */
  async rankForQuery(
    query: string,
    options: { targetType?: CampaignTargetType; limit?: number } = {},
  ): Promise<RankedCampaign[]> {
    const limit = options.limit ?? 10;
    const cacheKey = this.buildCacheKey(query, options.targetType, limit);

    return this.cache.getOrSet(cacheKey, () => this.computeRanking(query, options), {
      ttl: CAMPAIGN_RANKING_CACHE_TTL_SECONDS,
      namespace: 'campaign-auction',
    });
  }

  /**
   * Pure ranking used by tests and cache misses.
   * Deterministic: equal scores resolve by newer `createdAt`, then `id`.
   */
  rankCampaigns(
    campaigns: Array<
      Pick<Campaign, 'id' | 'targetType' | 'targetId' | 'bidModel' | 'bidAmount' | 'createdAt'> & {
        qualityScore: number;
      }
    >,
    limit = 10,
  ): RankedCampaign[] {
    return campaigns
      .map((c) => ({
        campaignId: c.id,
        targetType: c.targetType,
        targetId: c.targetId,
        bidModel: c.bidModel,
        bidAmount: c.bidAmount,
        qualityScore: c.qualityScore,
        score: c.bidAmount * c.qualityScore,
        createdAt: c.createdAt.toISOString(),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (byDate !== 0) return byDate;
        return b.campaignId.localeCompare(a.campaignId);
      })
      .slice(0, limit);
  }

  private async computeRanking(
    query: string,
    options: { targetType?: CampaignTargetType; limit?: number },
  ): Promise<RankedCampaign[]> {
    const now = new Date();
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        ...(options.targetType ? { targetType: options.targetType } : {}),
        OR: [{ startAt: null }, { startAt: { lte: now } }],
        AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
      },
    });

    const withQuality = await Promise.all(
      campaigns.map(async (campaign) => {
        const document = await this.loadTargetDocument(campaign.targetType, campaign.targetId);
        const qualityScore = document
          ? this.aiFeed.scoreQueryRelevance(query, document)
          : 0;
        return { ...campaign, qualityScore };
      }),
    );

    const ranked = this.rankCampaigns(withQuality, options.limit ?? 10);
    this.logger.debug(`Ranked ${ranked.length} campaigns for query hash ${cacheKeyHash(query)}`);
    return ranked;
  }

  private async loadTargetDocument(
    targetType: CampaignTargetType,
    targetId: string,
  ): Promise<{ title: string; description: string; tags?: string[]; categoryId?: string } | null> {
    if (targetType === 'JOB') {
      const job = await this.prisma.job.findUnique({ where: { id: targetId } });
      if (!job) return null;
      return {
        title: job.title,
        description: job.description,
        tags: job.tags,
        categoryId: job.categoryId,
      };
    }

    if (targetType === 'GIG') {
      const gig = await this.prisma.freelanceJob.findUnique({ where: { id: targetId } });
      if (!gig) return null;
      return {
        title: gig.title,
        description: gig.description,
        tags: gig.skills,
        categoryId: gig.categoryId,
      };
    }

    // PROPOSAL → Bid (+ parent gig text for relevance)
    const bid = await this.prisma.bid.findUnique({
      where: { id: targetId },
      include: { freelanceJob: true },
    });
    if (!bid) return null;
    return {
      title: bid.freelanceJob.title,
      description: `${bid.coverLetter}\n${bid.freelanceJob.description}`,
      tags: bid.freelanceJob.skills,
      categoryId: bid.freelanceJob.categoryId,
    };
  }

  private buildCacheKey(query: string, targetType: CampaignTargetType | undefined, limit: number): string {
    return `rank:${cacheKeyHash(query)}:${targetType ?? 'ALL'}:${limit}`;
  }
}

function cacheKeyHash(query: string): string {
  return createHash('sha256').update(query.trim().toLowerCase()).digest('hex').slice(0, 16);
}
