"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadBalancerModule = void 0;
const common_1 = require("@nestjs/common");
const load_balancer_controller_1 = require("./load-balancer.controller");
const load_balancer_health_check_service_1 = require("./load-balancer-health-check.service");
const load_balancer_service_1 = require("./load-balancer.service");
const ip_hash_strategy_1 = require("./strategies/ip-hash.strategy");
const least_connections_strategy_1 = require("./strategies/least-connections.strategy");
const load_balancer_strategy_factory_1 = require("./strategies/load-balancer-strategy.factory");
const round_robin_strategy_1 = require("./strategies/round-robin.strategy");
let LoadBalancerModule = class LoadBalancerModule {
};
exports.LoadBalancerModule = LoadBalancerModule;
exports.LoadBalancerModule = LoadBalancerModule = __decorate([
    (0, common_1.Module)({
        controllers: [load_balancer_controller_1.LoadBalancerController],
        providers: [
            load_balancer_service_1.LoadBalancerService,
            load_balancer_health_check_service_1.LoadBalancerHealthCheckService,
            round_robin_strategy_1.RoundRobinStrategy,
            least_connections_strategy_1.LeastConnectionsStrategy,
            ip_hash_strategy_1.IpHashStrategy,
            load_balancer_strategy_factory_1.LoadBalancerStrategyFactory,
        ],
        exports: [load_balancer_service_1.LoadBalancerService, load_balancer_health_check_service_1.LoadBalancerHealthCheckService],
    })
], LoadBalancerModule);
//# sourceMappingURL=load-balancer.module.js.map