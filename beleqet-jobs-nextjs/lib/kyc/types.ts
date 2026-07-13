import { z } from 'zod';

import { kycUploadTokensSchema, kycVerificationResponseSchema } from './schemas';

/**
 * Supported identity document types.
 *
 * Must stay synchronized with backend:
 * SubmitKycDto
 */
export type IdDocumentType = 'NATIONAL_ID' | 'PASSPORT' | 'DRIVERS_LICENSE';

/**
 * Represents a file selected
 * by the user before upload.
 *
 * Used by:
 * - ID document upload
 * - Face verification upload
 */
export interface KycFileState {
  file: File | null;

  previewUrl: string | null;
}

/**
 * Response returned from:
 *
 * POST /kyc/upload-urls
 *
 * Contains temporary cloud storage
 * upload credentials.
 */
export type KycUploadTokens = z.infer<typeof kycUploadTokensSchema>;

/**
 * Payload submitted after successful
 * direct cloud uploads.
 *
 * Matches backend:
 *
 * POST /kyc/verifications
 *
 */
export interface SubmitKycPayload {
  /**
   * Selected government document type
   */
  documentType: IdDocumentType;

  /**
   * Private storage key generated
   * by backend upload service
   */
  documentStorageKey: string;

  /**
   * Private storage key generated
   * by backend upload service
   */
  faceScanStorageKey: string;

  /**
   * Original MIME type of document.
   *
   * Example:
   * image/jpeg
   */
  documentMimeType: string;

  /**
   * Original MIME type of selfie.
   *
   * Example:
   * image/jpeg
   */
  faceScanMimeType: string;
}

/**
 * Backend response after submitting
 * KYC verification request.
 */
export type KycVerificationResponse = z.infer<typeof kycVerificationResponseSchema>;

/**
 * KYC wizard states.
 *
 * 1 - Select document type
 * 2 - Upload ID document
 * 3 - Face verification
 * 4 - Processing
 */
export type KycStep = 1 | 2 | 3 | 4;

/**
 * Generic backend API error.
 *
 * Matches NestJS validation errors.
 */
export interface ApiErrorResponse {
  message: string | string[];
}
