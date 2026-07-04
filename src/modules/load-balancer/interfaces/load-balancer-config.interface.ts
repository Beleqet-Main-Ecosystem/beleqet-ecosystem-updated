import { LoadBalancerStrategy } from '../constants/load-balancer.constants';

/** Mutable runtime configuration for the load-balancer module. */
export interface LoadBalancerConfig {
  strategy: LoadBalancerStrategy;
  stickySessionsEnabled: boolean;
  healthCheckIntervalMs: number;
  healthCheckPath: string;
  healthCheckTimeoutMs: number;
}
