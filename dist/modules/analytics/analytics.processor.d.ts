import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
export declare class AnalyticsProcessor {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    logEvent(job: Job<{
        eventType: string;
        [key: string]: unknown;
    }>): Promise<void>;
    updateJobStats(job: Job<{
        jobId: string;
    }>): Promise<void>;
}
