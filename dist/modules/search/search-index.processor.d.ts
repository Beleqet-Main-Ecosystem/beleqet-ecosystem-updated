import { Job as BullJob } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
interface IndexJobPayload {
    action: 'upsert' | 'delete';
    entityType: 'job' | 'freelance_job';
    entityId: string;
}
export declare class SearchIndexProcessor {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    indexJob(job: BullJob<IndexJobPayload>): Promise<void>;
}
export {};
