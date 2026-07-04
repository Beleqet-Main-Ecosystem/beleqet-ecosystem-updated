import { BackendInstance } from '../interfaces/backend-instance.interface';
import { ILoadBalancerStrategy, RouteContext } from '../interfaces/load-balancer-strategy.interface';
export declare class RoundRobinStrategy implements ILoadBalancerStrategy {
    readonly name = "round_robin";
    private cursor;
    select(backends: BackendInstance[], _context: RouteContext): BackendInstance | null;
    resetCursor(): void;
}
