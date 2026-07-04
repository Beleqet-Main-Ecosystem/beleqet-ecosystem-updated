import { Module } from '@nestjs/common';
import { LoadBalancerController } from './load-balancer.controller';
import { LoadBalancerHealthCheckService } from './load-balancer-health-check.service';
import { LoadBalancerService } from './load-balancer.service';
import { IpHashStrategy } from './strategies/ip-hash.strategy';
import { LeastConnectionsStrategy } from './strategies/least-connections.strategy';
import { LoadBalancerStrategyFactory } from './strategies/load-balancer-strategy.factory';
import { RoundRobinStrategy } from './strategies/round-robin.strategy';

/**
 * Performance & Network — Load Balancer module.
 *
 * Distributes incoming traffic across multiple backend instances using
 * Round Robin, Least Connections, or IP Hash strategies with health checks
 * and optional sticky-session affinity.
 */
@Module({
  controllers: [LoadBalancerController],
  providers: [
    LoadBalancerService,
    LoadBalancerHealthCheckService,
    RoundRobinStrategy,
    LeastConnectionsStrategy,
    IpHashStrategy,
    LoadBalancerStrategyFactory,
  ],
  exports: [LoadBalancerService, LoadBalancerHealthCheckService],
})
export class LoadBalancerModule {}
