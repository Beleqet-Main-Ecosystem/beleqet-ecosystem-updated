import { z } from 'zod';

/**
 * Response returned after requesting
 * temporary upload URLs.
 */
export const kycUploadTokensSchema = z.object({
  documentStorageKey: z.string(),

  faceScanStorageKey: z.string(),

  documentUploadUrl: z.string().url(),

  faceScanUploadUrl: z.string().url(),
});

/**
 * Response returned after
 * submitting a verification.
 */
export const kycVerificationResponseSchema = z.object({
  success: z.boolean(),

  message: z.string().optional(),

  status: z.string().optional(),
});
