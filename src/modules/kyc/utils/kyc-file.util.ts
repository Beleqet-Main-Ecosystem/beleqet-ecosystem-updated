/**
 * MIME types supported for KYC image uploads.
 */
export const ALLOWED_KYC_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Checks whether the provided MIME type is supported for
 * KYC image uploads.
 *
 * @param contentType MIME type supplied by the client.
 *
 * @returns True if the MIME type is supported; otherwise false.
 */
export function isSupportedKycMimeType(contentType: string): boolean {
  return ALLOWED_KYC_MIME_TYPES.includes(contentType as (typeof ALLOWED_KYC_MIME_TYPES)[number]);
}
export function getExtensionFromMimeType(contentType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  return mimeMap[contentType] ?? 'jpg';
}
