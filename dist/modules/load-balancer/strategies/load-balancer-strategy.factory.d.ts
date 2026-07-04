import { LoadBalancerStrategy } from '../constants/load-balancer.constants';
import { ILoadBalancerStrategy } from '../interfaces/load-balancer-strategy.interface';
import { IpHashStrategy } from './ip-hash.strategy';
import { LeastConnectionsStrategy } from './least-connections.strategy';
import { RoundRobinStrategy } from './round-robin.strategy';
export declare class LoadBalancerStrategyFactory {
    private readonly roundRobin;
    private readonly leastConnections;
    private readonly ipHash;
    private readonly strategyMap;
    constructor(roundRobin: RoundRobinStrategy, leastConnections: LeastConnectionsStrategy, ipHash: IpHashStrategy);
    getStrategy(strategy: LoadBalancerStrategy): ILoadBalancerStrategy;
}
