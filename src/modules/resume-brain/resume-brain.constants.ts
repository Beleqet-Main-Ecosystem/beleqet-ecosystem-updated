/**
 * Shared constants for the Resume Brain module.
 *
 * Kept in one place so the upload validators (Phase 2) and the document
 * parser (Phase 3) agree on exactly which file types and size limits are
 * supported.
 */

/** Maximum accepted resume size: 5 MB. */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Human-readable form of {@link MAX_FILE_SIZE_BYTES} for error messages. */
export const MAX_FILE_SIZE_LABEL = '5MB';

/** Allowed MIME types: PDF and modern .docx only (legacy .doc cannot be parsed). */
export const ALLOWED_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];

/** Allowed file extensions, used as a fallback when the MIME type is generic. */
export const ALLOWED_EXTENSIONS: readonly string[] = ['.pdf', '.docx'];
