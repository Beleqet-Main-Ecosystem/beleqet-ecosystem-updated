import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
interface IndexJobPayload {
    action: 'upsert' | 'delete';
    entityType: 'job' | 'freelance_job';
    entityId: string;
}
export declare class SearchIndexProcessor extends WorkerHost {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    process(job: Job<IndexJobPayload>): Promise<any>;
}
export {};
