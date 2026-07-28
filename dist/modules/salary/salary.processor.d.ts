import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
export declare class SalaryProcessor extends WorkerHost {
    private readonly prismaService;
    private readonly logger;
    private readonly locationMultipliers;
    private readonly industryMultipliers;
    private readonly experienceLevelMultipliers;
    constructor(prismaService: PrismaService);
    process(job: Job): Promise<void>;
    private handleUpdatePredictions;
    private handleComputeAnalytics;
    private handleArchiveOldData;
    private handleGenerateReports;
    private handleAnonymizeData;
    private computeGrowthRate;
}
