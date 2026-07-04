import { Injectable } from '@nestjs/common';
import { BackendInstance } from '../interfaces/backend-instance.interface';
import {
  ILoadBalancerStrategy,
  RouteContext,
} from '../interfaces/load-balancer-strategy.interface';
import { hashString, hashToIndex } from '../utils/ip-hash.util';

/**
 * Maps a client IP (or session key) to a consistent backend via hashing.
 * Provides natural sticky-session behaviour without server-side session storage.
 */
@Injectable()
export class IpHashStrategy implements ILoadBalancerStrategy {
  readonly name = 'ip_hash';

  /**
   * Hash the client IP or session ID to pick a stable backend index.
   * @param backends - Healthy backend instances.
   * @param context - Must include clientIp or sessionId.
   */
  select(backends: BackendInstance[], context: RouteContext): BackendInstance | null {
    if (backends.length === 0) return null;

    const affinityKey = context.sessionId ?? context.clientIp;
    if (!affinityKey) {
      return backends[0];
    }

    const index = hashToIndex(hashString(affinityKey), backends.length);
    return backends[index] ?? null;
  }
}
