import { BackendInstance } from '../interfaces/backend-instance.interface';
import { ILoadBalancerStrategy, RouteContext } from '../interfaces/load-balancer-strategy.interface';
export declare class LeastConnectionsStrategy implements ILoadBalancerStrategy {
    readonly name = "least_connections";
    select(backends: BackendInstance[], _context: RouteContext): BackendInstance | null;
}
