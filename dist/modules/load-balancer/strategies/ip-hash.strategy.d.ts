import { BackendInstance } from '../interfaces/backend-instance.interface';
import { ILoadBalancerStrategy, RouteContext } from '../interfaces/load-balancer-strategy.interface';
export declare class IpHashStrategy implements ILoadBalancerStrategy {
    readonly name = "ip_hash";
    select(backends: BackendInstance[], context: RouteContext): BackendInstance | null;
}
