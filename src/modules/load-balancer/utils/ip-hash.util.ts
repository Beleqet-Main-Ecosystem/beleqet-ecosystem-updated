/**
 * Deterministic 32-bit FNV-1a hash for IP-based backend selection.
 * @param input - Client IP or session identifier.
 */
export function hashString(input: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/**
 * Map a hash value to an index within a bounded array.
 * @param hash - Unsigned 32-bit hash.
 * @param length - Pool size (must be > 0).
 */
export function hashToIndex(hash: number, length: number): number {
  return hash % length;
}
