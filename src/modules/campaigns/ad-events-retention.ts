/**
 * GDPR retention for append-only ad telemetry.
 * Raw IP / User-Agent are never stored — only SHA-256 hashes + pseudonymous sessionRef.
 */
export const AD_EVENTS_RETENTION_DAYS = 90;

/**
 * Purges ad_events older than {@link AD_EVENTS_RETENTION_DAYS}.
 * Called from campaign cron / compliance jobs.
 */
export async function purgeExpiredAdEvents(
  deleteOlderThan: (cutoff: Date) => Promise<number>,
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - AD_EVENTS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return deleteOlderThan(cutoff);
}
