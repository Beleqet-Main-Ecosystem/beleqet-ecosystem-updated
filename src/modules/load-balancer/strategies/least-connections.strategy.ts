import { Injectable } from '@nestjs/common';
import { BackendInstance } from '../interfaces/backend-instance.interface';
import {
  ILoadBalancerStrategy,
  RouteContext,
} from '../interfaces/load-balancer-strategy.interface';

/**
 * Routes each new request to the backend with the fewest active connections.
 * Ideal when request durations vary significantly.
 */
@Injectable()
export class LeastConnectionsStrategy implements ILoadBalancerStrategy {
  readonly name = 'least_connections';

  /**
   * Select the backend with the lowest activeConnections count.
   * Ties are broken by pool order for deterministic behaviour.
   * @param backends - Healthy backend instances.
   * @param _context - Unused for least-connections.
   */
  select(backends: BackendInstance[], _context: RouteContext): BackendInstance | null {
    if (backends.length === 0) return null;

    return backends.reduce((best, current) =>
      current.activeConnections < best.activeConnections ? current : best,
    );
  }
}
