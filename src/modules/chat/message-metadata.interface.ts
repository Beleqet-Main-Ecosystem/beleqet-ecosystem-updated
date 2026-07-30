// src/modules/chat/message-metadata.interface.ts
/**
 * Structured metadata for chat messages.
 *
 * - `encrypted`: true when the `content` field holds AES‑GCM ciphertext.
 * - `iv`: Hex‑encoded initialization vector (12 bytes) required for decryption.
 * - Additional optional fields can be added for future extensions (e.g., file information,
 *   video‑call links, etc.).
 */
export interface MessageMetadata {
  /** Indicates whether the message payload is encrypted */
  encrypted?: boolean;
  /** Hex‑encoded initialization vector (IV) used for AES‑GCM encryption */
  iv?: string;
  /** Optional type discriminator for non‑text messages (e.g., 'file', 'video_call') */
  type?: string;
  /** Optional URL for file or video‑call resources */
  url?: string;
  /** Optional display name for the resource */
  name?: string;
  /** Optional link for video calls */
  link?: string;
  /** Index signature — required for Prisma JSON column compatibility */
  [key: string]: unknown;
}
