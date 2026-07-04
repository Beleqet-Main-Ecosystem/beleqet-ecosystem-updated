import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { LoadBalancerStrategy } from './constants/load-balancer.constants';
import { RegisterBackendDto, RouteRequestDto, UpdateLoadBalancerConfigDto } from './dto/load-balancer.dto';
import { BackendInstance, BackendPublicView } from './interfaces/backend-instance.interface';
import { LoadBalancerConfig } from './interfaces/load-balancer-config.interface';
import { LoadBalancerStrategyFactory } from './strategies/load-balancer-strategy.factory';
export declare class LoadBalancerService {
    private readonly configService;
    private readonly strategyFactory;
    private readonly i18n;
    private readonly logger;
    private readonly backends;
    private readonly stickySessions;
    private config;
    constructor(configService: ConfigService, strategyFactory: LoadBalancerStrategyFactory, i18n: I18nService);
    getConfig(): LoadBalancerConfig;
    updateConfig(dto: UpdateLoadBalancerConfigDto): LoadBalancerConfig;
    registerBackend(dto: RegisterBackendDto): BackendPublicView;
    removeBackend(backendId: string): {
        removed: boolean;
    };
    listBackends(includeInternal?: boolean): BackendPublicView[] | BackendInstance[];
    routeRequest(dto: RouteRequestDto, clientIpFallback?: string): {
        backendId: string;
        targetUrl: string;
        strategy: LoadBalancerStrategy;
        sessionAffinity: boolean;
    };
    releaseConnection(backendId: string): void;
    setBackendHealth(backendId: string, healthy: boolean): void;
    getStatus(): {
        totalBackends: number;
        healthyBackends: number;
        strategy: LoadBalancerStrategy;
        stickySessionsEnabled: boolean;
        activeStickySessions: number;
    };
    getBackendInstances(): BackendInstance[];
    getHealthCheckSettings(): Pick<LoadBalancerConfig, 'healthCheckPath' | 'healthCheckTimeoutMs'>;
    getHealthCheckIntervalMs(): number;
    private buildRouteContext;
    private filterCandidates;
    private resolveStickyBackend;
    private buildInitialConfig;
    private bootstrapBackendsFromEnv;
}
