import { Injectable } from '@nestjs/common';
import { BackendInstance } from '../interfaces/backend-instance.interface';
import {
  ILoadBalancerStrategy,
  RouteContext,
} from '../interfaces/load-balancer-strategy.interface';

/**
 * Distributes requests sequentially across healthy backends.
 * Suitable for homogeneous servers with similar capacity.
 */
@Injectable()
export class RoundRobinStrategy implements ILoadBalancerStrategy {
  readonly name = 'round_robin';

  private cursor = 0;

  /**
   * Pick the next backend using a circular index over the pool.
   * @param backends - Healthy backend instances.
   * @param _context - Unused for round-robin (kept for interface parity).
   */
  select(backends: BackendInstance[], _context: RouteContext): BackendInstance | null {
    if (backends.length === 0) return null;
    const selected = backends[this.cursor % backends.length];
    this.cursor = (this.cursor + 1) % backends.length;
    return selected;
  }

  /** Reset the internal cursor — useful in tests. */
  resetCursor(): void {
    this.cursor = 0;
  }
}
