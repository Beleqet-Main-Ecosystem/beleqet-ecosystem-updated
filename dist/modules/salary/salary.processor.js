"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SalaryProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const prisma_service_1 = require("../../prisma/prisma.service");
let SalaryProcessor = SalaryProcessor_1 = class SalaryProcessor extends bullmq_1.WorkerHost {
    constructor(prismaService) {
        super();
        this.prismaService = prismaService;
        this.logger = new common_1.Logger(SalaryProcessor_1.name);
        this.locationMultipliers = {
            'Addis Ababa': 1.3,
            'Dire Dawa': 1.0,
            Hawassa: 0.9,
            Mekelle: 0.85,
            Adama: 0.95,
            'Bahir Dar': 0.9,
        };
        this.industryMultipliers = {
            Technology: 1.5,
            Finance: 1.4,
            Healthcare: 1.2,
            Education: 0.9,
            Retail: 0.7,
            Manufacturing: 0.95,
            Telecommunications: 1.3,
            Consulting: 1.35,
        };
        this.experienceLevelMultipliers = {
            JUNIOR: 0.7,
            MID: 1.0,
            SENIOR: 1.4,
            LEAD: 1.8,
            PRINCIPAL: 2.2,
        };
    }
    async process(job) {
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
    async handleUpdatePredictions(job) {
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
            this.logger.log(`[Job: update-predictions] Found ${stalePredictions.length} stale predictions`);
            const BATCH_SIZE = 20;
            const now = new Date();
            for (let i = 0; i < stalePredictions.length; i += BATCH_SIZE) {
                const batch = stalePredictions.slice(i, i + BATCH_SIZE);
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
                        const relevantJobs = marketJobs.filter((j) => j.title.toLowerCase().includes(prediction.jobTitle.toLowerCase()) ||
                            prediction.jobTitle.toLowerCase().includes(j.title.toLowerCase()));
                        if (relevantJobs.length > 0) {
                            const midpoints = relevantJobs.map((j) => Math.round(((j.salaryMin ?? 0) + (j.salaryMax ?? 0)) / 2));
                            const total = midpoints.reduce((sum, v) => sum + v, 0);
                            const averageSalary = Math.round(total / midpoints.length);
                            const sorted = [...midpoints].sort((a, b) => a - b);
                            const medianSalary = midpoints.length % 2 === 0
                                ? Math.round((sorted[midpoints.length / 2 - 1] + sorted[midpoints.length / 2]) / 2)
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
                        }
                        else {
                            const locationMultiplier = this.locationMultipliers?.[prediction.location] ?? 1.0;
                            const industryMultiplier = this.industryMultipliers?.[prediction.industry ?? 'Technology'] ?? 1.0;
                            const experienceMultiplier = this.experienceLevelMultipliers?.[prediction.experienceLevel ?? 'MID'] ?? 1.0;
                            const adjustedSalary = 80000 * locationMultiplier * industryMultiplier * experienceMultiplier;
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
            this.logger.log(`[Job: update-predictions] Successfully updated ${stalePredictions.length} predictions`);
            await job.updateProgress(100);
        }
        catch (error) {
            this.logger.error('[Job: update-predictions] Error updating predictions:', error);
            throw error;
        }
    }
    async handleComputeAnalytics(job) {
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
                if (predictionCount === 0)
                    continue;
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
        }
        catch (error) {
            this.logger.error('[Job: compute-analytics] Error computing analytics:', error);
            throw error;
        }
    }
    async handleArchiveOldData(job) {
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
            this.logger.log(`[Job: archive-old-data] Found ${oldPredictions.length} predictions to archive`);
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
            this.logger.log(`[Job: archive-old-data] Archived and deleted ${oldPredictions.length} predictions`);
            await job.updateProgress(100);
        }
        catch (error) {
            this.logger.error('[Job: archive-old-data] Error archiving old data:', error);
            throw error;
        }
    }
    async handleGenerateReports(job) {
        this.logger.log('[Job: generate-reports] Starting salary report generation...');
        try {
            const locations = ['Addis Ababa', 'Dire Dawa', 'Hawassa'];
            for (const location of locations) {
                const stats = await this.prismaService.salaryAnalytics.findMany({
                    where: { location },
                    orderBy: { computedAt: 'desc' },
                    take: 10,
                });
                this.logger.log(`[Job: generate-reports] Generated report for ${location} with ${stats.length} records`);
            }
            this.logger.log('[Job: generate-reports] Report generation completed');
            await job.updateProgress(100);
        }
        catch (error) {
            this.logger.error('[Job: generate-reports] Error generating reports:', error);
            throw error;
        }
    }
    async handleAnonymizeData(job) {
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
        }
        catch (error) {
            this.logger.error('[Job: anonymize-data] Error anonymizing data:', error);
            throw error;
        }
    }
    async computeGrowthRate(location, industry) {
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
};
exports.SalaryProcessor = SalaryProcessor;
exports.SalaryProcessor = SalaryProcessor = SalaryProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('salary'),
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SalaryProcessor);
//# sourceMappingURL=salary.processor.js.map