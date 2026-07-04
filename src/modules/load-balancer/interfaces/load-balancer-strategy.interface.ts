import { BackendInstance } from './backend-instance.interface';

/** Context passed to a routing strategy when selecting the next backend. */
export interface RouteContext {
  /** Client IP used for IP-hash and sticky-session affinity. */
  clientIp: string;
  /** Optional session key for sticky-session routing. */
  sessionId?: string;
  /** Preferred currency from X-Currency header (multi-currency routing). */
  currency?: string;
  /** Preferred region from X-Region header. */
  region?: string;
}

/** Contract implemented by every load-balancing algorithm. */
export interface ILoadBalancerStrategy {
  /** Human-readable strategy name. */
  readonly name: string;
  /**
   * Select the next healthy backend from the pool.
   * @param backends - Candidate backend instances (already filtered for health).
   * @param context - Client routing context.
   */
  select(backends: BackendInstance[], context: RouteContext): BackendInstance | null;
}
