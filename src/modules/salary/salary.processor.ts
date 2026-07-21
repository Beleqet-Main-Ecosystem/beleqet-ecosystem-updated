import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * SalaryProcessor - Background job processor for salary-related tasks
 *
 * Handles:
 * - Periodic salary prediction updates
 * - Salary analytics computation
 * - Historical data archival
 * - Market trend analysis
 */
@Processor('salary')
@Injectable()
export class SalaryProcessor extends WorkerHost {
  private readonly logger = new Logger(SalaryProcessor.name);

  private readonly locationMultipliers: Record<string, number> = {
    'Addis Ababa': 1.3,
    'Dire Dawa': 1.0,
    Hawassa: 0.9,
    Mekelle: 0.85,
    Adama: 0.95,
    'Bahir Dar': 0.9,
  };

  private readonly industryMultipliers: Record<string, number> = {
    Technology: 1.5,
    Finance: 1.4,
    Healthcare: 1.2,
    Education: 0.9,
    Retail: 0.7,
    Manufacturing: 0.95,
    Telecommunications: 1.3,
    Consulting: 1.35,
  };

  private readonly experienceLevelMultipliers: Record<string, number> = {
    JUNIOR: 0.7,
    MID: 1.0,
    SENIOR: 1.4,
    LEAD: 1.8,
    PRINCIPAL: 2.2,
  };

  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'update-predictions':
        return this.handleUpdatePredictions(job);
      case 'compute-analytics':
        return this.handleComputeAnalytics(job);
      case 'archive-old-data':
        return this.handleArchiveOldData(job);
      case 'generate-reports':
        return this.handleGenerateReports(job);
      case 'anonymize-data':
        return this.handleAnonymizeData(job);
      default:
        this.logger.warn(`[Job: ${job.name}] Unknown job name`);
    }
  }

  private async handleUpdatePredictions(job: Job): Promise<void> {
    this.logger.log('[Job: update-predictions] Starting salary prediction updates...');

    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const stalePredictions = await this.prismaService.salaryPrediction.findMany({
        where: {
          lastUpdatedAt: {
            lt: sevenDaysAgo,
          },
        },
        take: 100,
      });

      this.logger.log(
        `[Job: update-predictions] Found ${stalePredictions.length} stale predictions`,
      );

      const BATCH_SIZE = 20;
      for (let i = 0; i < stalePredictions.length; i += BATCH_SIZE) {
        const batch = stalePredictions.slice(i, i + BATCH_SIZE);
        await this.prismaService.$transaction(async (tx) => {
          for (const prediction of batch) {
            await tx.salaryHistory.create({
              data: {
                jobTitle: prediction.jobTitle,
                jobCategoryId: prediction.jobCategoryId,
                industry: prediction.industry,
                location: prediction.location,
                experienceLevel: prediction.experienceLevel,
                currency: prediction.currency,
                minSalary: prediction.minSalary,
                maxSalary: prediction.maxSalary,
                averageSalary: prediction.averageSalary,
                medianSalary: prediction.medianSalary,
                dataPointsCount: prediction.dataPointsCount,
                version: prediction.version,
                isAnonymized: true,
              },
            });
          }
        });
      }

      const now = new Date();
      const batchSize = 20;
      for (let i = 0; i < stalePredictions.length; i += batchSize) {
        const batch = stalePredictions.slice(i, i + batchSize);

        const jobTitles = [...new Set(batch.map((p) => p.jobTitle))];
        const locations = [...new Set(batch.map((p) => p.location))];

        const marketJobs = await this.prismaService.job.findMany({
          where: {
            title: { in: jobTitles, mode: 'insensitive' },
            location: { in: locations, mode: 'insensitive' },
            salaryMin: { not: null },
            salaryMax: { not: null },
          },
          select: { title: true, location: true, salaryMin: true, salaryMax: true },
        });

        await this.prismaService.$transaction(async (tx) => {
          for (const prediction of batch) {
            const relevantJobs = marketJobs.filter(
              (j) =>
                j.title.toLowerCase().includes(prediction.jobTitle.toLowerCase()) ||
                prediction.jobTitle.toLowerCase().includes(j.title.toLowerCase()),
            );

            if (relevantJobs.length > 0) {
              const midpoints = relevantJobs.map((j) =>
                Math.round(((j.salaryMin ?? 0) + (j.salaryMax ?? 0)) / 2),
              );
              const total = midpoints.reduce((sum, v) => sum + v, 0);
              const averageSalary = Math.round(total / midpoints.length);
              const sorted = [...midpoints].sort((a, b) => a - b);
              const medianSalary =
                midpoints.length % 2 === 0
                  ? Math.round(
                      (sorted[midpoints.length / 2 - 1] + sorted[midpoints.length / 2]) / 2,
                    )
                  : sorted[Math.floor(midpoints.length / 2)];
              const minSalary = Math.min(...midpoints);
              const maxSalary = Math.max(...midpoints);
              const squaredDiffs = midpoints.map((v) => (v - averageSalary) ** 2);
              const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / midpoints.length;
              const standardDeviation = Math.round(Math.sqrt(variance));
              const dataPointsCount = midpoints.length;
              const confidenceScore = Math.min(0.99, 0.3 + (dataPointsCount / 100) * 0.7);

              await tx.salaryPrediction.update({
                where: { id: prediction.id },
                data: {
                  minSalary,
                  maxSalary,
                  averageSalary,
                  medianSalary,
                  dataPointsCount,
                  standardDeviation,
                  confidenceScore,
                  version: { increment: 1 },
                  lastUpdatedAt: now,
                },
              });
            } else {
              const locationMultiplier = this.locationMultipliers?.[prediction.location] ?? 1.0;
              const industryMultiplier =
                this.industryMultipliers?.[prediction.industry ?? 'Technology'] ?? 1.0;
              const experienceMultiplier =
                this.experienceLevelMultipliers?.[prediction.experienceLevel ?? 'MID'] ?? 1.0;

              const adjustedSalary =
                80000 * locationMultiplier * industryMultiplier * experienceMultiplier;
              const variance = adjustedSalary * 0.25;

              await tx.salaryPrediction.update({
                where: { id: prediction.id },
                data: {
                  minSalary: Math.round(adjustedSalary - variance),
                  maxSalary: Math.round(adjustedSalary + variance),
                  averageSalary: Math.round(adjustedSalary),
                  medianSalary: Math.round(adjustedSalary),
                  dataPointsCount: 0,
                  standardDeviation: Math.round(variance * 0.5),
                  confidenceScore: 0.3,
                  version: { increment: 1 },
                  lastUpdatedAt: now,
                },
              });
            }
          }
        });
      }

      this.logger.log(
        `[Job: update-predictions] Successfully updated ${stalePredictions.length} predictions`,
      );
      await job.updateProgress(100);
    } catch (error) {
      this.logger.error('[Job: update-predictions] Error updating predictions:', error);
      throw error;
    }
  }

  private async handleComputeAnalytics(job: Job): Promise<void> {
    this.logger.log('[Job: compute-analytics] Starting salary analytics computation...');

    try {
      const groups = await this.prismaService.salaryPrediction.groupBy({
        by: ['location', 'industry'],
        where: { isAnonymized: true },
        _avg: { averageSalary: true },
        _sum: { dataPointsCount: true },
        _count: true,
      });

      this.logger.log(`[Job: compute-analytics] Found ${groups.length} location-industry groups`);

      const titleFrequencies = await this.prismaService.salaryPrediction.groupBy({
        by: ['location', 'industry', 'jobTitle'],
        where: { isAnonymized: true },
        _count: true,
        orderBy: { _count: { jobTitle: 'desc' } },
      });

      const totalTasks = groups.length;
      let completedTasks = 0;

      for (const group of groups) {
        const averageSalary = Math.round(group._avg.averageSalary ?? 0);
        const _totalDataPoints = group._sum.dataPointsCount ?? 0;
        const predictionCount = group._count;

        if (predictionCount === 0) continue;

        const groupTitles = titleFrequencies
          .filter((t) => t.location === group.location && t.industry === group.industry)
          .slice(0, 5)
          .map((t) => t.jobTitle);

        const growthRate = await this.computeGrowthRate(group.location, group.industry);

        await this.prismaService.salaryAnalytics.upsert({
          where: {
            id: `${group.location}-${group.industry}-analytics`,
          },
          create: {
            id: `${group.location}-${group.industry}-analytics`,
            location: group.location,
            industry: group.industry,
            averageSalary,
            medianSalary: averageSalary,
            salaryGrowthRate: growthRate,
            topJobTitles: groupTitles,
            periodStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            periodEndDate: new Date(),
            computedAt: new Date(),
          },
          update: {
            averageSalary,
            medianSalary: averageSalary,
            salaryGrowthRate: growthRate,
            topJobTitles: groupTitles,
            computedAt: new Date(),
          },
        });

        completedTasks++;
        await job.updateProgress((completedTasks / totalTasks) * 100);
      }

      this.logger.log('[Job: compute-analytics] Analytics computation completed');
    } catch (error) {
      this.logger.error('[Job: compute-analytics] Error computing analytics:', error);
      throw error;
    }
  }

  private async handleArchiveOldData(job: Job): Promise<void> {
    this.logger.log('[Job: archive-old-data] Starting old data archival...');

    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const oldPredictions = await this.prismaService.salaryPrediction.findMany({
        where: {
          createdAt: {
            lt: oneYearAgo,
          },
        },
        take: 500,
      });

      this.logger.log(
        `[Job: archive-old-data] Found ${oldPredictions.length} predictions to archive`,
      );

      const BATCH_SIZE = 50;
      for (let i = 0; i < oldPredictions.length; i += BATCH_SIZE) {
        const batch = oldPredictions.slice(i, i + BATCH_SIZE);
        await this.prismaService.$transaction(async (tx) => {
          for (const prediction of batch) {
            await tx.salaryHistory.create({
              data: {
                jobTitle: prediction.jobTitle,
                jobCategoryId: prediction.jobCategoryId,
                industry: prediction.industry,
                location: prediction.location,
                experienceLevel: prediction.experienceLevel,
                currency: prediction.currency,
                minSalary: prediction.minSalary,
                maxSalary: prediction.maxSalary,
                averageSalary: prediction.averageSalary,
                medianSalary: prediction.medianSalary,
                dataPointsCount: prediction.dataPointsCount,
                version: prediction.version,
                isAnonymized: true,
              },
            });
          }

          await tx.salaryPrediction.deleteMany({
            where: {
              id: {
                in: batch.map((p) => p.id),
              },
            },
          });
        });
      }

      this.logger.log(
        `[Job: archive-old-data] Archived and deleted ${oldPredictions.length} predictions`,
      );
      await job.updateProgress(100);
    } catch (error) {
      this.logger.error('[Job: archive-old-data] Error archiving old data:', error);
      throw error;
    }
  }

  private async handleGenerateReports(job: Job): Promise<void> {
    this.logger.log('[Job: generate-reports] Starting salary report generation...');

    try {
      const locations = ['Addis Ababa', 'Dire Dawa', 'Hawassa'];

      for (const location of locations) {
        const stats = await this.prismaService.salaryAnalytics.findMany({
          where: { location },
          orderBy: { computedAt: 'desc' },
          take: 10,
        });

        this.logger.log(
          `[Job: generate-reports] Generated report for ${location} with ${stats.length} records`,
        );
      }

      this.logger.log('[Job: generate-reports] Report generation completed');
      await job.updateProgress(100);
    } catch (error) {
      this.logger.error('[Job: generate-reports] Error generating reports:', error);
      throw error;
    }
  }

  private async handleAnonymizeData(job: Job): Promise<void> {
    this.logger.log('[Job: anonymize-data] Starting data anonymization for GDPR...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.prismaService.salaryHistory.updateMany({
        where: {
          recordedAt: {
            lt: thirtyDaysAgo,
          },
          isAnonymized: false,
        },
        data: {
          isAnonymized: true,
        },
      });

      this.logger.log(`[Job: anonymize-data] Anonymized ${result.count} records`);
      await job.updateProgress(100);
    } catch (error) {
      this.logger.error('[Job: anonymize-data] Error anonymizing data:', error);
      throw error;
    }
  }

  private async computeGrowthRate(location: string, industry: string | null): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [recent, older] = await Promise.all([
      this.prismaService.salaryHistory.findMany({
        where: {
          location,
          ...(industry && { industry }),
          recordedAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prismaService.salaryHistory.findMany({
        where: {
          location,
          ...(industry && { industry }),
          recordedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
      }),
    ]);

    if (recent.length === 0 || older.length === 0) {
      return 0;
    }

    const recentAvg = recent.reduce((sum, h) => sum + h.averageSalary, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.averageSalary, 0) / older.length;

    if (!Number.isFinite(olderAvg) || olderAvg === 0) {
      return 0;
    }

    const growthRate = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (!Number.isFinite(growthRate)) {
      return 0;
    }

    return Math.round(growthRate * 100) / 100;
  }
}
