/** Supported load-balancing algorithms for the Beleqet ecosystem. */
export enum LoadBalancerStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  IP_HASH = 'ip_hash',
}

/** Injection token for pluggable routing strategies. */
export const LOAD_BALANCER_STRATEGIES = 'LOAD_BALANCER_STRATEGIES';

/** Default health-check path probed on each backend instance. */
export const DEFAULT_HEALTH_CHECK_PATH = '/api/v1/load-balancer/ping';

/** Default interval between automated health checks (milliseconds). */
export const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 30_000;
