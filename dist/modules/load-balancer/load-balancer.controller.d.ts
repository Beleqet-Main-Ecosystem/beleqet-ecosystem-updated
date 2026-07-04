import { Request } from 'express';
import { RegisterBackendDto, RouteRequestDto, UpdateLoadBalancerConfigDto } from './dto/load-balancer.dto';
import { LoadBalancerHealthCheckService } from './load-balancer-health-check.service';
import { LoadBalancerService } from './load-balancer.service';
type RequestWithIp = Request & {
    ip?: string;
};
export declare class LoadBalancerController {
    private readonly loadBalancerService;
    private readonly healthCheckService;
    constructor(loadBalancerService: LoadBalancerService, healthCheckService: LoadBalancerHealthCheckService);
    ping(): {
        status: string;
        timestamp: string;
    };
    getStatus(): {
        totalBackends: number;
        healthyBackends: number;
        strategy: import("./constants/load-balancer.constants").LoadBalancerStrategy;
        stickySessionsEnabled: boolean;
        activeStickySessions: number;
    };
    listBackendsPublic(): import("./interfaces/backend-instance.interface").BackendInstance[] | import("./interfaces/backend-instance.interface").BackendPublicView[];
    routeRequest(dto: RouteRequestDto, currencyHeader: string | undefined, regionHeader: string | undefined, sessionHeader: string | undefined, req: RequestWithIp): {
        backendId: string;
        targetUrl: string;
        strategy: import("./constants/load-balancer.constants").LoadBalancerStrategy;
        sessionAffinity: boolean;
    };
    releaseConnection(backendId: string): void;
    listBackendsAdmin(): import("./interfaces/backend-instance.interface").BackendInstance[] | import("./interfaces/backend-instance.interface").BackendPublicView[];
    getConfig(): import("./interfaces/load-balancer-config.interface").LoadBalancerConfig;
    updateConfig(dto: UpdateLoadBalancerConfigDto): import("./interfaces/load-balancer-config.interface").LoadBalancerConfig;
    registerBackend(dto: RegisterBackendDto): import("./interfaces/backend-instance.interface").BackendPublicView;
    removeBackend(id: string): {
        removed: boolean;
    };
    triggerHealthCheck(): Promise<{
        checked: number;
        healthy: number;
        unhealthy: number;
    }>;
}
export {};
