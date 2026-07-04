import { Injectable } from '@nestjs/common';
import { LoadBalancerStrategy } from '../constants/load-balancer.constants';
import { ILoadBalancerStrategy } from '../interfaces/load-balancer-strategy.interface';
import { IpHashStrategy } from './ip-hash.strategy';
import { LeastConnectionsStrategy } from './least-connections.strategy';
import { RoundRobinStrategy } from './round-robin.strategy';

/**
 * Resolves the active routing strategy from configuration via Dependency Injection.
 */
@Injectable()
export class LoadBalancerStrategyFactory {
  private readonly strategyMap: Map<LoadBalancerStrategy, ILoadBalancerStrategy>;

  constructor(
    private readonly roundRobin: RoundRobinStrategy,
    private readonly leastConnections: LeastConnectionsStrategy,
    private readonly ipHash: IpHashStrategy,
  ) {
    this.strategyMap = new Map<LoadBalancerStrategy, ILoadBalancerStrategy>([
      [LoadBalancerStrategy.ROUND_ROBIN, this.roundRobin],
      [LoadBalancerStrategy.LEAST_CONNECTIONS, this.leastConnections],
      [LoadBalancerStrategy.IP_HASH, this.ipHash],
    ]);
  }

  /**
   * Return the strategy implementation for the given algorithm name.
   * @param strategy - Configured load-balancing algorithm.
   */
  getStrategy(strategy: LoadBalancerStrategy): ILoadBalancerStrategy {
    const resolved = this.strategyMap.get(strategy);
    if (!resolved) {
      return this.roundRobin;
    }
    return resolved;
  }
}
