import type { Response } from 'express';
import { HealthService } from './health.service';
import type { LivenessResult } from './health.service';
export declare class HealthController {
    private readonly healthService;
    constructor(healthService: HealthService);
    liveness(): LivenessResult;
    readiness(res: Response): Promise<void>;
}
