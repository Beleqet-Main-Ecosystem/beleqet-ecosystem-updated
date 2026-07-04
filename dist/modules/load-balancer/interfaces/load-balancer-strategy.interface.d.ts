import { BackendInstance } from './backend-instance.interface';
export interface RouteContext {
    clientIp: string;
    sessionId?: string;
    currency?: string;
    region?: string;
}
export interface ILoadBalancerStrategy {
    readonly name: string;
    select(backends: BackendInstance[], context: RouteContext): BackendInstance | null;
}
