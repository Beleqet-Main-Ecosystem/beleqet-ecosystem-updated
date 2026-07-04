import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoadBalancerService } from './load-balancer.service';
export declare class LoadBalancerHealthCheckService implements OnModuleInit, OnModuleDestroy {
    private readonly loadBalancerService;
    private readonly logger;
    private intervalHandle;
    constructor(loadBalancerService: LoadBalancerService);
    onModuleInit(): void;
    onModuleDestroy(): void;
    runHealthChecks(): Promise<{
        checked: number;
        healthy: number;
        unhealthy: number;
    }>;
    private probeBackend;
}
