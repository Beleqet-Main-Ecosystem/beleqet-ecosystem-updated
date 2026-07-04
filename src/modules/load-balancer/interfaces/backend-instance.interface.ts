/** Runtime state of a single backend server in the load-balancer pool. */
export interface BackendInstance {
  /** Stable identifier used for sticky-session affinity. */
  id: string;
  /** Public or internal base URL (never returned to non-admin callers). */
  url: string;
  /** ISO 3166-1 alpha-2 region code for geo-aware routing. */
  region: string;
  /** ISO 4217 currency codes this instance serves (multi-currency support). */
  supportedCurrencies: string[];
  /** Active in-flight connections tracked for least-connections strategy. */
  activeConnections: number;
  /** Result of the most recent health probe. */
  healthy: boolean;
  /** Timestamp of the last successful health check. */
  lastHealthCheckAt: Date | null;
  /** Optional weight for future weighted round-robin extensions. */
  weight: number;
}

/** Public, GDPR-safe view of a backend (no internal URLs). */
export interface BackendPublicView {
  id: string;
  region: string;
  supportedCurrencies: string[];
  healthy: boolean;
  activeConnections: number;
}
