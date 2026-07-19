/**
 * Abstraction over symmetric encryption of OAuth access/refresh tokens
 * before they are persisted. Consumers (strategies, services) depend on
 * this interface — never on Node's `crypto` module or a specific cipher
 * implementation directly — so the algorithm can be swapped (e.g. to a
 * KMS-backed envelope encryption scheme) without touching call sites.
 */
export interface ITokenCipher {
  /**
   * Encrypts a plaintext token.
   *
   * @param plaintext - The raw provider access/refresh token.
   * @returns An opaque, self-contained ciphertext string safe to persist.
   */
  encrypt(plaintext: string): string;

  /**
   * Decrypts a ciphertext previously produced by {@link encrypt}.
   *
   * @param ciphertext - The opaque string produced by {@link encrypt}.
   * @returns The original plaintext token.
   * @throws Error if the ciphertext is malformed or fails authentication
   *   (i.e. it was tampered with, or encrypted under a different key).
   */
  decrypt(ciphertext: string): string;
}

/** Injection token for {@link ITokenCipher} implementations. */
export const TOKEN_CIPHER = Symbol('TOKEN_CIPHER');