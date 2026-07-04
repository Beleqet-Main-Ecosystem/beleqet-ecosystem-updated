export declare enum LoadBalancerStrategy {
    ROUND_ROBIN = "round_robin",
    LEAST_CONNECTIONS = "least_connections",
    IP_HASH = "ip_hash"
}
export declare const LOAD_BALANCER_STRATEGIES = "LOAD_BALANCER_STRATEGIES";
export declare const DEFAULT_HEALTH_CHECK_PATH = "/api/v1/load-balancer/ping";
export declare const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 30000;
