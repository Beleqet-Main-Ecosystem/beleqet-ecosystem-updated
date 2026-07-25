import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

interface TokenUsageDetail {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
  readonly matchCount: number;
}

interface DailyUsage extends TokenUsageDetail {
  readonly date: string;
}

interface TokenUsageSummary {
  readonly total: TokenUsageDetail;
  readonly today: TokenUsageDetail;
  readonly thisWeek: TokenUsageDetail;
  readonly thisMonth: TokenUsageDetail;
  readonly thisYear: TokenUsageDetail;
  readonly dailyHistory: readonly DailyUsage[];
}

const DEFAULT_PROMPT_COST = 0.0001;
const DEFAULT_COMPLETION_COST = 0.0004;

@Injectable()
export class TokenUsageService {
  private readonly logger = new Logger(TokenUsageService.name);
  private readonly promptCostPer1K: number;
  private readonly completionCostPer1K: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.promptCostPer1K = parseFloat(
      config.get<string>('AI_MATCHING_PROMPT_TOKEN_COST_PER_1K') ?? String(DEFAULT_PROMPT_COST),
    );
    this.completionCostPer1K = parseFloat(
      config.get<string>('AI_MATCHING_COMPLETION_TOKEN_COST_PER_1K') ??
        String(DEFAULT_COMPLETION_COST),
    );
  }

  private calcCost(prompt: number, completion: number): number {
    const promptCost = (prompt / 1000) * this.promptCostPer1K;
    const completionCost = (completion / 1000) * this.completionCostPer1K;
    return Math.round((promptCost + completionCost) * 100) / 100;
  }

  async recordUsage(
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    matchCount: number,
  ): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const cost = this.calcCost(promptTokens, completionTokens);

    try {
      await this.prisma.tokenUsageDaily.upsert({
        where: { date: today },
        create: {
          date: today,
          matchCount,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd: cost,
        },
        update: {
          matchCount: { increment: matchCount },
          promptTokens: { increment: promptTokens },
          completionTokens: { increment: completionTokens },
          totalTokens: { increment: totalTokens },
          estimatedCostUsd: { increment: cost },
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record token usage: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  async getDailyHistory(days = 30): Promise<readonly DailyUsage[]> {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - days);

    const rows = await this.prisma.tokenUsageDaily.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      totalTokens: r.totalTokens,
      estimatedCostUsd: r.estimatedCostUsd ?? 0,
      matchCount: r.matchCount,
    }));
  }

  async getSummary(): Promise<TokenUsageSummary> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfDay);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());

    const startOfMonth = new Date(startOfDay);
    startOfMonth.setUTCDate(1);

    const startOfYear = new Date(startOfDay);
    startOfYear.setUTCMonth(0, 1);

    const [totalRow, todayRow, weekRow, monthRow, yearRow] = await Promise.all([
      this.prisma.tokenUsageDaily.aggregate({
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          matchCount: true,
          estimatedCostUsd: true,
        },
      }),
      this.prisma.tokenUsageDaily.aggregate({
        where: { date: { gte: startOfDay } },
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          matchCount: true,
          estimatedCostUsd: true,
        },
      }),
      this.prisma.tokenUsageDaily.aggregate({
        where: { date: { gte: startOfWeek } },
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          matchCount: true,
          estimatedCostUsd: true,
        },
      }),
      this.prisma.tokenUsageDaily.aggregate({
        where: { date: { gte: startOfMonth } },
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          matchCount: true,
          estimatedCostUsd: true,
        },
      }),
      this.prisma.tokenUsageDaily.aggregate({
        where: { date: { gte: startOfYear } },
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          matchCount: true,
          estimatedCostUsd: true,
        },
      }),
    ]);

    const toDetail = (row: typeof totalRow): TokenUsageDetail => ({
      promptTokens: row._sum.promptTokens ?? 0,
      completionTokens: row._sum.completionTokens ?? 0,
      totalTokens: row._sum.totalTokens ?? 0,
      estimatedCostUsd: Math.round((row._sum.estimatedCostUsd ?? 0) * 100) / 100,
      matchCount: row._sum.matchCount ?? 0,
    });

    const dailyHistory = await this.getDailyHistory(30);

    return {
      total: toDetail(totalRow),
      today: toDetail(todayRow),
      thisWeek: toDetail(weekRow),
      thisMonth: toDetail(monthRow),
      thisYear: toDetail(yearRow),
      dailyHistory,
    };
  }
}
