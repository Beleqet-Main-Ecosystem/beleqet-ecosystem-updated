import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrencyService, CurrencyCode } from './currency/currency.service';
import {
  CreateSalaryPredictionDto,
  SalaryPredictionResponseDto,
  BatchSalaryPredictionDto,
  BatchSalaryPredictionResponseDto,
  SalaryStatisticsDto,
  SalaryPredictionQueryDto,
} from './dto/salary-prediction.dto';

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

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

  constructor(
    private readonly prismaService: PrismaService,
    private readonly currencyService: CurrencyService,
  ) {}

  async predictSalary(dto: CreateSalaryPredictionDto): Promise<SalaryPredictionResponseDto> {
    this.logger.debug(`Predicting salary for: ${dto.jobTitle} in ${dto.location}`);

    if (!dto.jobTitle || !dto.location) {
      throw new BadRequestException('Job title and location are required');
    }

    const requestedCurrency = (dto.currency || 'ETB') as CurrencyCode;
    if (!this.currencyService.isSupported(requestedCurrency)) {
      throw new BadRequestException(`Unsupported currency: ${dto.currency}`);
    }

    const existingPrediction = await this.prismaService.salaryPrediction.findFirst({
      where: {
        jobTitle: { equals: dto.jobTitle, mode: 'insensitive' },
        location: { equals: dto.location, mode: 'insensitive' },
        experienceLevel: dto.experienceLevel,
        industry: dto.industry || undefined,
      },
      orderBy: { lastUpdatedAt: 'desc' },
    });

    if (existingPrediction && this.isPredictionFresh(existingPrediction.lastUpdatedAt)) {
      this.logger.debug(`Found fresh prediction for ${dto.jobTitle}`);
      const response = this.mapPredictionToResponse(existingPrediction);
      if (existingPrediction.currency && existingPrediction.currency !== requestedCurrency) {
        const converted = this.currencyService.convertSalaryPrediction(
          response,
          requestedCurrency,
          existingPrediction.currency as CurrencyCode,
        );
        return { ...response, ...converted };
      }
      return response;
    }

    const calculatedPrediction = await this.calculatePredictionFromJobData(dto);

    const savedPrediction = await this.prismaService.$transaction(async (tx) => {
      if (existingPrediction) {
        await tx.salaryHistory.create({
          data: {
            jobTitle: existingPrediction.jobTitle,
            jobCategoryId: existingPrediction.jobCategoryId,
            industry: existingPrediction.industry,
            location: existingPrediction.location,
            experienceLevel: existingPrediction.experienceLevel,
            currency: existingPrediction.currency,
            minSalary: existingPrediction.minSalary,
            maxSalary: existingPrediction.maxSalary,
            averageSalary: existingPrediction.averageSalary,
            medianSalary: existingPrediction.medianSalary,
            dataPointsCount: existingPrediction.dataPointsCount,
            version: existingPrediction.version,
            isAnonymized: true,
          },
        });

        return tx.salaryPrediction.update({
          where: { id: existingPrediction.id },
          data: {
            minSalary: calculatedPrediction.minSalary,
            maxSalary: calculatedPrediction.maxSalary,
            averageSalary: calculatedPrediction.averageSalary,
            medianSalary: calculatedPrediction.medianSalary,
            dataPointsCount: calculatedPrediction.dataPointsCount,
            standardDeviation: calculatedPrediction.standardDeviation,
            confidenceScore: calculatedPrediction.confidenceScore,
            version: { increment: 1 },
          },
        });
      }

      return tx.salaryPrediction.create({
        data: {
          jobTitle: dto.jobTitle,
          jobCategoryId: dto.jobCategoryId,
          industry: dto.industry,
          location: dto.location,
          experienceLevel: dto.experienceLevel,
          currency: dto.currency || 'ETB',
          minSalary: calculatedPrediction.minSalary,
          maxSalary: calculatedPrediction.maxSalary,
          averageSalary: calculatedPrediction.averageSalary,
          medianSalary: calculatedPrediction.medianSalary,
          dataPointsCount: calculatedPrediction.dataPointsCount,
          standardDeviation: calculatedPrediction.standardDeviation,
          confidenceScore: calculatedPrediction.confidenceScore,
          version: 1,
          isAnonymized: true,
        },
      });
    });

    this.logger.log(`Salary prediction saved: ${savedPrediction.id}`);
    const response = this.mapPredictionToResponse(savedPrediction);

    if (dto.currency && dto.currency !== 'ETB') {
      const converted = this.currencyService.convertSalaryPrediction(
        response,
        requestedCurrency,
        'ETB',
      );
      return { ...response, ...converted };
    }
    return response;
  }

  /**
   * Get salary statistics and trends for analytics dashboard
   *
   * @param location - Geographic location filter
   * @param industry - Industry sector filter
   * @param daysBack - Number of days to look back (default: 30)
   * @param targetCurrency - Currency to return values in (default: ETB)
   * @returns Aggregated salary statistics
   */
  async getSalaryStatistics(
    location: string,
    industry?: string,
    daysBack: number = 30,
    targetCurrency: CurrencyCode = 'ETB',
  ): Promise<SalaryStatisticsDto> {
    this.logger.debug(`Getting salary statistics for ${location}`);

    // Validate currency
    if (!this.currencyService.isSupported(targetCurrency)) {
      throw new BadRequestException(`Unsupported currency: ${targetCurrency}`);
    }

    const periodStartDate = new Date();
    periodStartDate.setDate(periodStartDate.getDate() - daysBack);
    const periodEndDate = new Date();

    // Fetch all relevant predictions within period
    const predictions = await this.prismaService.salaryPrediction.findMany({
      where: {
        location: {
          equals: location,
          mode: 'insensitive',
        },
        ...(industry && {
          industry: {
            equals: industry,
            mode: 'insensitive',
          },
        }),
        lastUpdatedAt: {
          gte: periodStartDate,
          lte: periodEndDate,
        },
      },
    });

    if (predictions.length === 0) {
      throw new NotFoundException(`No salary data found for ${location}`);
    }

    // Calculate aggregate statistics
    const averages = this.calculateAggregateStatistics(predictions);
    const growthRate = await this.calculateSalaryGrowthRate(location, industry);

    let averageSalary = Math.round(averages.avg);
    let medianSalary = Math.round(averages.median);

    // Convert to target currency if needed
    if (targetCurrency !== 'ETB') {
      averageSalary = this.currencyService.convert(averageSalary, 'ETB', targetCurrency);
      medianSalary = this.currencyService.convert(medianSalary, 'ETB', targetCurrency);
    }

    return {
      location,
      industry,
      averageSalary,
      medianSalary,
      salaryGrowthRate: growthRate,
      currency: targetCurrency,
      dataPointsCount: predictions.length,
      periodStartDate,
      periodEndDate,
    };
  }

  /**
   * Batch predict salaries for multiple positions
   * Optimized for performance with batch processing
   *
   * @param dto - Batch of salary predictions
   * @returns Array of predictions with success/failure counts
   */
  async batchPredict(dto: BatchSalaryPredictionDto): Promise<BatchSalaryPredictionResponseDto> {
    if (dto.predictions.length > 50) {
      throw new BadRequestException('Maximum 50 predictions per batch allowed');
    }

    this.logger.debug(`Processing batch of ${dto.predictions.length} predictions`);

    const results: SalaryPredictionResponseDto[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const predictionDto of dto.predictions) {
      try {
        const result = await this.predictSalary(predictionDto);
        results.push(result);
        successCount++;
      } catch (error) {
        this.logger.error(`Batch prediction failed for ${predictionDto.jobTitle}:`, error);
        failureCount++;
      }
    }

    return {
      predictions: results,
      processedAt: new Date(),
      successCount,
      failureCount,
    };
  }

  /**
   * Get historical salary trend for a position
   * GDPR-compliant aggregated view
   *
   * @param jobTitle - Job position
   * @param location - Geographic location
   * @param limit - Number of historical records to fetch
   * @returns Salary history records
   */
  async getSalaryHistory(
    jobTitle: string,
    location: string,
    limit: number = 12,
  ): Promise<SalaryStatisticsDto[]> {
    this.logger.debug(`Fetching history for ${jobTitle} in ${location}`);

    const history = await this.prismaService.salaryHistory.findMany({
      where: {
        jobTitle: {
          equals: jobTitle,
          mode: 'insensitive',
        },
        location: {
          equals: location,
          mode: 'insensitive',
        },
      },
      orderBy: {
        recordedAt: 'desc',
      },
      take: limit,
    });

    return history.map((record) => ({
      jobTitle: record.jobTitle,
      location: record.location,
      industry: record.industry ?? undefined,
      experienceLevel: record.experienceLevel ?? undefined,
      averageSalary: record.averageSalary,
      medianSalary: record.medianSalary,
      salaryGrowthRate: 0,
      currency: record.currency,
      dataPointsCount: record.dataPointsCount,
      periodStartDate: record.recordedAt,
      periodEndDate: record.recordedAt,
    }));
  }

  /**
   * Get all predictions with filtering and pagination
   *
   * @param query - Filter and pagination parameters
   * @returns Paginated predictions
   */
  async getPredictions(query: SalaryPredictionQueryDto): Promise<{
    data: SalaryPredictionResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = ((query.page ?? 1) - 1) * (query.limit ?? 20);
    const take = query.limit ?? 20;

    const where: any = {};
    if (query.jobTitle) {
      where.jobTitle = { contains: query.jobTitle, mode: 'insensitive' };
    }
    if (query.location) {
      where.location = { contains: query.location, mode: 'insensitive' };
    }
    if (query.experienceLevel) {
      where.experienceLevel = query.experienceLevel;
    }
    if (query.industry) {
      where.industry = { contains: query.industry, mode: 'insensitive' };
    }

    const [predictions, total] = await Promise.all([
      this.prismaService.salaryPrediction.findMany({
        where,
        skip,
        take,
        orderBy: {
          [query.sortBy || 'lastUpdatedAt']: query.sortOrder || 'desc',
        },
      }),
      this.prismaService.salaryPrediction.count({ where }),
    ]);

    return {
      data: predictions.map((p) => this.mapPredictionToResponse(p)),
      total,
      page: query.page ?? 1,
      limit: take,
    };
  }

  // ============= Private Helper Methods =============

  /**
   * Check if a prediction is still fresh (less than 7 days old)
   */
  private isPredictionFresh(lastUpdatedAt: Date): boolean {
    const daysOld = (Date.now() - lastUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysOld < 7;
  }

  private async calculatePredictionFromJobData(dto: CreateSalaryPredictionDto): Promise<{
    minSalary: number;
    maxSalary: number;
    averageSalary: number;
    medianSalary: number;
    dataPointsCount: number;
    standardDeviation: number;
    confidenceScore: number;
  }> {
    const matchingJobs = await this.prismaService.job.findMany({
      where: {
        title: { contains: dto.jobTitle, mode: 'insensitive' },
        location: { contains: dto.location, mode: 'insensitive' },
        salaryMin: { not: null },
        salaryMax: { not: null },
      },
      select: { salaryMin: true, salaryMax: true },
      take: 500,
    });

    const dataPointsCount = matchingJobs.length;

    if (dataPointsCount > 0) {
      const midpoints = matchingJobs.map((j) =>
        Math.round(((j.salaryMin ?? 0) + (j.salaryMax ?? 0)) / 2),
      );

      const total = midpoints.reduce((sum, v) => sum + v, 0);
      const averageSalary = Math.round(total / dataPointsCount);

      const sorted = [...midpoints].sort((a, b) => a - b);
      const medianSalary =
        dataPointsCount % 2 === 0
          ? Math.round((sorted[dataPointsCount / 2 - 1] + sorted[dataPointsCount / 2]) / 2)
          : sorted[Math.floor(dataPointsCount / 2)];

      const squaredDiffs = midpoints.map((v) => (v - averageSalary) ** 2);
      const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / dataPointsCount;
      const standardDeviation = Math.round(Math.sqrt(variance));

      const minSalary = Math.min(...midpoints);
      const maxSalary = Math.max(...midpoints);

      const confidenceScore = Math.min(0.99, 0.3 + (dataPointsCount / 100) * 0.7);

      this.logger.debug(
        `Prediction from ${dataPointsCount} actual job postings: avg=${averageSalary}, confidence=${confidenceScore.toFixed(2)}`,
      );

      return {
        minSalary,
        maxSalary,
        averageSalary,
        medianSalary,
        dataPointsCount,
        standardDeviation,
        confidenceScore,
      };
    }

    const locationMultiplier = this.locationMultipliers[dto.location] || 1.0;
    const industryMultiplier = this.industryMultipliers[dto.industry || 'Technology'] || 1.0;
    const experienceMultiplier = this.experienceLevelMultipliers[dto.experienceLevel] || 1.0;

    const fallbackBase = 80000;
    const adjustedSalary =
      fallbackBase * locationMultiplier * industryMultiplier * experienceMultiplier;

    const variance = adjustedSalary * 0.25;
    const minSalary = Math.round(adjustedSalary - variance);
    const maxSalary = Math.round(adjustedSalary + variance);
    const averageSalary = Math.round(adjustedSalary);
    const medianSalary = Math.round(adjustedSalary);
    const standardDeviation = Math.round(variance * 0.5);

    this.logger.debug(
      `No job postings found — using fallback estimate: ${averageSalary} (confidence: 0.30)`,
    );

    return {
      minSalary,
      maxSalary,
      averageSalary,
      medianSalary,
      dataPointsCount: 0,
      standardDeviation,
      confidenceScore: 0.3,
    };
  }

  /**
   * Calculate month-over-month salary growth rate
   */
  private async calculateSalaryGrowthRate(location: string, industry?: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [recentHistory, olderHistory] = await Promise.all([
      this.prismaService.salaryHistory.findMany({
        where: {
          location: { equals: location, mode: 'insensitive' },
          ...(industry && { industry: { equals: industry, mode: 'insensitive' } }),
          recordedAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prismaService.salaryHistory.findMany({
        where: {
          location: { equals: location, mode: 'insensitive' },
          ...(industry && { industry: { equals: industry, mode: 'insensitive' } }),
          recordedAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo,
          },
        },
      }),
    ]);

    if (recentHistory.length === 0 || olderHistory.length === 0) {
      return 0;
    }

    const recentAvg =
      recentHistory.reduce((sum, h) => sum + h.averageSalary, 0) / recentHistory.length;
    const olderAvg =
      olderHistory.reduce((sum, h) => sum + h.averageSalary, 0) / olderHistory.length;

    // Safeguard against division-by-zero / non-finite numbers
    if (!Number.isFinite(olderAvg) || olderAvg === 0) {
      return 0;
    }

    const growthRate = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (!Number.isFinite(growthRate)) {
      return 0;
    }

    return Math.round(growthRate * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate aggregate statistics from multiple predictions
   */
  private calculateAggregateStatistics(predictions: any[]): { avg: number; median: number } {
    if (predictions.length === 0) {
      return { avg: 0, median: 0 };
    }

    const totalWeight = predictions.reduce((sum, p) => sum + (p.dataPointsCount || 1), 0);
    const avg =
      predictions.reduce((sum, p) => sum + p.averageSalary * (p.dataPointsCount || 1), 0) /
      totalWeight;

    const sortedBySalary = [...predictions].sort((a, b) => a.averageSalary - b.averageSalary);
    let cumulativeWeight = 0;
    let median = sortedBySalary[0]?.averageSalary || 0;
    for (const p of sortedBySalary) {
      cumulativeWeight += p.dataPointsCount || 1;
      if (cumulativeWeight >= totalWeight / 2) {
        median = p.averageSalary;
        break;
      }
    }

    return { avg: Math.round(avg), median };
  }

  /**
   * Map Prisma model to response DTO
   */
  private mapPredictionToResponse(prediction: any): SalaryPredictionResponseDto {
    return {
      id: prediction.id,
      jobTitle: prediction.jobTitle,
      location: prediction.location,
      experienceLevel: prediction.experienceLevel,
      industry: prediction.industry,
      minSalary: prediction.minSalary,
      maxSalary: prediction.maxSalary,
      averageSalary: prediction.averageSalary,
      medianSalary: prediction.medianSalary,
      currency: prediction.currency,
      dataPointsCount: prediction.dataPointsCount,
      standardDeviation: prediction.standardDeviation,
      confidenceScore: prediction.confidenceScore,
      version: prediction.version,
      lastUpdatedAt: prediction.lastUpdatedAt,
      createdAt: prediction.createdAt,
    };
  }
}
