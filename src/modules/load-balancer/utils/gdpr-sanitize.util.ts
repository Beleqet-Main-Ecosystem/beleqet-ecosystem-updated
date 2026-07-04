import { BackendInstance, BackendPublicView } from '../interfaces/backend-instance.interface';

/**
 * Strip internal infrastructure details before returning data to non-admin users (GDPR data minimization).
 * @param backend - Full backend instance from the in-memory pool.
 */
export function toPublicBackendView(backend: BackendInstance): BackendPublicView {
  return {
    id: backend.id,
    region: backend.region,
    supportedCurrencies: backend.supportedCurrencies,
    healthy: backend.healthy,
    activeConnections: backend.activeConnections,
  };
}

/**
 * Mask client IP for audit logs — keeps only the first two octets (GDPR pseudonymization).
 * @param clientIp - Raw client IP address.
 */
export function pseudonymizeIp(clientIp: string): string {
  const parts = clientIp.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  return 'masked';
}
