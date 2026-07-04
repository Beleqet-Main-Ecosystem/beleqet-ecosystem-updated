import { LoadBalancerStrategy } from '../constants/load-balancer.constants';
export declare class RegisterBackendDto {
    id: string;
    url: string;
    region?: string;
    supportedCurrencies?: string[];
    weight?: number;
}
export declare class UpdateLoadBalancerConfigDto {
    strategy?: LoadBalancerStrategy;
    stickySessionsEnabled?: boolean;
    healthCheckIntervalMs?: number;
    healthCheckPath?: string;
}
export declare class RouteRequestDto {
    clientIp?: string;
    sessionId?: string;
    currency?: string;
    region?: string;
}
