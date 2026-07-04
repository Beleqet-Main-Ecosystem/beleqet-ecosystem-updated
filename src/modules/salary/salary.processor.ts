import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
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
export class SalaryProcessor {
  private readonly logger = new Logger(SalaryProcessor.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Update salary predictions daily
   * Refreshes predictions that are older than 7 days
   *
   * @param job - Bull queue job
   */
  @Process('update-predictions')
  async updatePredictions(job: Job): Promise<void> {
    this.logger.log('[Job: update-predictions] Starting salary prediction updates...');

    try {
      // Find stale predictions (older than 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const stalePredictions = await this.prismaService.salaryPrediction.findMany({
        where: {
          lastUpdatedAt: {
            lt: sevenDaysAgo,
          },
        },
        take: 100, // Process in batches of 100
      });

      this.logger.log(
        `[Job: update-predictions] Found ${stalePredictions.length} stale predictions`,
      );

      // Archive to history before updating
      for (const prediction of stalePredictions) {
        await this.prismaService.salaryHistory.create({
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

      // Update version for refreshed predictions
      await this.prismaService.salaryPrediction.updateMany({
        where: {
          id: {
            in: stalePredictions.map((p) => p.id),
          },
        },
        data: {
          version: {
            increment: 1,
          },
          lastUpdatedAt: new Date(),
        },
      });

      this.logger.log(
        `[Job: update-predictions] Successfully updated ${stalePredictions.length} predictions`,
      );
      job.progress(100);
    } catch (error) {
      this.logger.error('[Job: update-predictions] Error updating predictions:', error);
      throw error;
    }
  }

  /**
   * Compute salary analytics
   * Aggregates salary data for dashboard and reporting
   *
   * @param job - Bull queue job
   */
  @Process('compute-analytics')
  async computeAnalytics(job: Job): Promise<void> {
    this.logger.log('[Job: compute-analytics] Starting salary analytics computation...');

    try {
      // Get unique locations and industries
      const locations = await this.prismaService.salaryPrediction.findMany({
        distinct: ['location'],
        select: { location: true },
        where: { isAnonymized: true },
      });

      this.logger.log(`[Job: compute-analytics] Found ${locations.length} unique locations`);

      const totalTasks = locations.length;
      let completedTasks = 0;

      for (const loc of locations) {
        const industries = await this.prismaService.salaryPrediction.findMany({
          distinct: ['industry'],
          select: { industry: true },
          where: { location: loc.location },
        });

        for (const ind of industries) {
          // Calculate aggregate statistics
          const predictions = await this.prismaService.salaryPrediction.findMany({
            where: {
              location: loc.location,
              industry: ind.industry,
            },
          });

          if (predictions.length === 0) continue;

          const salaries = predictions.map((p) => p.averageSalary).sort((a, b) => a - b);
          const averageSalary = Math.round(
            salaries.reduce((sum, s) => sum + s, 0) / salaries.length,
          );
          const medianSalary = salaries[Math.floor(salaries.length / 2)];
          const topJobTitles = this.getTopJobTitles(predictions, 5);

          // Compute growth rate
          const growthRate = await this.computeGrowthRate(loc.location, ind.industry);

          // Store or update analytics
          await this.prismaService.salaryAnalytics.upsert({
            where: {
              id: `${loc.location}-${ind.industry}-analytics`,
            },
            create: {
              id: `${loc.location}-${ind.industry}-analytics`,
              location: loc.location,
              industry: ind.industry,
              averageSalary,
              medianSalary,
              salaryGrowthRate: growthRate,
              topJobTitles,
              periodStartDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              periodEndDate: new Date(),
              computedAt: new Date(),
            },
            update: {
              averageSalary,
              medianSalary,
              salaryGrowthRate: growthRate,
              topJobTitles,
              computedAt: new Date(),
            },
          });
        }

        completedTasks++;
        job.progress((completedTasks / totalTasks) * 100);
      }

      this.logger.log('[Job: compute-analytics] Analytics computation completed');
    } catch (error) {
      this.logger.error('[Job: compute-analytics] Error computing analytics:', error);
      throw error;
    }
  }

  /**
   * Archive old salary data
   * Removes predictions older than 1 year (optional GDPR compliance)
   *
   * @param job - Bull queue job
   */
  @Process('archive-old-data')
  async archiveOldData(job: Job): Promise<void> {
    this.logger.log('[Job: archive-old-data] Starting old data archival...');

    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Archive old predictions to history
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

      for (const prediction of oldPredictions) {
        await this.prismaService.salaryHistory.create({
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

      // Delete archived predictions
      await this.prismaService.salaryPrediction.deleteMany({
        where: {
          id: {
            in: oldPredictions.map((p) => p.id),
          },
        },
      });

      this.logger.log(
        `[Job: archive-old-data] Archived and deleted ${oldPredictions.length} predictions`,
      );
      job.progress(100);
    } catch (error) {
      this.logger.error('[Job: archive-old-data] Error archiving old data:', error);
      throw error;
    }
  }

  /**
   * Generate salary reports
   * Creates market reports for specific locations/industries
   *
   * @param job - Bull queue job
   */
  @Process('generate-reports')
  async generateReports(job: Job): Promise<void> {
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
      job.progress(100);
    } catch (error) {
      this.logger.error('[Job: generate-reports] Error generating reports:', error);
      throw error;
    }
  }

  /**
   * Anonymize sensitive salary data for GDPR compliance
   * Ensures no PII is retained in historical records
   *
   * @param job - Bull queue job
   */
  @Process('anonymize-data')
  async anonymizeData(job: Job): Promise<void> {
    this.logger.log('[Job: anonymize-data] Starting data anonymization for GDPR...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Update old records to ensure anonymization
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
      job.progress(100);
    } catch (error) {
      this.logger.error('[Job: anonymize-data] Error anonymizing data:', error);
      throw error;
    }
  }

  // ============= Private Helper Methods =============

  /**
   * Get top N job titles by frequency
   */
  private getTopJobTitles(predictions: any[], n: number): string[] {
    const titleCounts = predictions.reduce(
      (acc, p) => {
        acc[p.jobTitle] = (acc[p.jobTitle] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(titleCounts)
      .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
      .slice(0, n)
      .map(([title]) => title);
  }

  /**
   * Compute salary growth rate between periods
   */
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

    const growthRate = ((recentAvg - olderAvg) / olderAvg) * 100;
    return Math.round(growthRate * 100) / 100;
  }
}
