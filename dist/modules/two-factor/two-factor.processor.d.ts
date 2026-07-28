import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TwoFactorService } from './two-factor.service';
export declare class TwoFactorProcessor extends WorkerHost {
    private readonly twoFactorService;
    private readonly logger;
    constructor(twoFactorService: TwoFactorService);
    process(job: Job): Promise<any>;
    private handleCleanup;
}
