import { LoadBalancerStrategy } from '../constants/load-balancer.constants';
export interface LoadBalancerConfig {
    strategy: LoadBalancerStrategy;
    stickySessionsEnabled: boolean;
    healthCheckIntervalMs: number;
    healthCheckPath: string;
    healthCheckTimeoutMs: number;
}
