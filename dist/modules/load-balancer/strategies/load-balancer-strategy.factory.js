"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadBalancerStrategyFactory = void 0;
const common_1 = require("@nestjs/common");
const load_balancer_constants_1 = require("../constants/load-balancer.constants");
const ip_hash_strategy_1 = require("./ip-hash.strategy");
const least_connections_strategy_1 = require("./least-connections.strategy");
const round_robin_strategy_1 = require("./round-robin.strategy");
let LoadBalancerStrategyFactory = class LoadBalancerStrategyFactory {
    constructor(roundRobin, leastConnections, ipHash) {
        this.roundRobin = roundRobin;
        this.leastConnections = leastConnections;
        this.ipHash = ipHash;
        this.strategyMap = new Map([
            [load_balancer_constants_1.LoadBalancerStrategy.ROUND_ROBIN, this.roundRobin],
            [load_balancer_constants_1.LoadBalancerStrategy.LEAST_CONNECTIONS, this.leastConnections],
            [load_balancer_constants_1.LoadBalancerStrategy.IP_HASH, this.ipHash],
        ]);
    }
    getStrategy(strategy) {
        const resolved = this.strategyMap.get(strategy);
        if (!resolved) {
            return this.roundRobin;
        }
        return resolved;
    }
};
exports.LoadBalancerStrategyFactory = LoadBalancerStrategyFactory;
exports.LoadBalancerStrategyFactory = LoadBalancerStrategyFactory = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [round_robin_strategy_1.RoundRobinStrategy,
        least_connections_strategy_1.LeastConnectionsStrategy,
        ip_hash_strategy_1.IpHashStrategy])
], LoadBalancerStrategyFactory);
//# sourceMappingURL=load-balancer-strategy.factory.js.map