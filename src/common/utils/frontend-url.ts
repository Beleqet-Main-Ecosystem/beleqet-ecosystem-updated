/**
 * FRONTEND_URL can list several allowed origins, comma-separated (the CORS allow-list reads it that
 * way). A link back to the website needs just one: the first.
 */
export function primaryFrontendUrl(
  raw: string | undefined,
  fallback = 'http://localhost:4001',
): string {
  const first = (raw ?? '').split(',')[0].trim().replace(/\/+$/, '');
  return first || fallback;
}
