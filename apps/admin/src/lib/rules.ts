/** Matches the API rule (src/modules/admin/admin-rules.ts): only take-downs, never re-opening. */
export function canTakeDown(listing: { type: 'JOB' | 'GIG'; status: string }): boolean {
  return listing.type === 'JOB' ? listing.status !== 'ARCHIVED' : listing.status === 'OPEN' || listing.status === 'DRAFT';
}

/** Parses the plan features box; null when it isn't a JSON object. */
export function parseFeatures(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text || '{}') as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
