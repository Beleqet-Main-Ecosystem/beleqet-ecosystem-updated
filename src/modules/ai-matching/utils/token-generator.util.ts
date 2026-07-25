import { randomBytes } from 'crypto';

/**
 * Generate a cryptographically secure opaque session token.
 * Tokens are unpredictable, contain no personal information,
 * and do not encode any internal database IDs.
 *
 * @param prefix - Optional prefix (e.g., "candidate", "session", "eval").
 * @returns A token string like "candidate_a81k92jd".
 */
export function generateOpaqueToken(prefix?: string): string {
  const raw = randomBytes(6).toString('base64url').slice(0, 8);
  return prefix ? `${prefix}_${raw}` : raw;
}
