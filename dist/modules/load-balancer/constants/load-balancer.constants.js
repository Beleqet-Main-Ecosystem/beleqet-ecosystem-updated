"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_HEALTH_CHECK_INTERVAL_MS = exports.DEFAULT_HEALTH_CHECK_PATH = exports.LOAD_BALANCER_STRATEGIES = exports.LoadBalancerStrategy = void 0;
var LoadBalancerStrategy;
(function (LoadBalancerStrategy) {
    LoadBalancerStrategy["ROUND_ROBIN"] = "round_robin";
    LoadBalancerStrategy["LEAST_CONNECTIONS"] = "least_connections";
    LoadBalancerStrategy["IP_HASH"] = "ip_hash";
})(LoadBalancerStrategy || (exports.LoadBalancerStrategy = LoadBalancerStrategy = {}));
exports.LOAD_BALANCER_STRATEGIES = 'LOAD_BALANCER_STRATEGIES';
exports.DEFAULT_HEALTH_CHECK_PATH = '/api/v1/load-balancer/ping';
exports.DEFAULT_HEALTH_CHECK_INTERVAL_MS = 30_000;
//# sourceMappingURL=load-balancer.constants.js.map