import axios from 'axios';

import { getToken } from '@/lib/auth';

import { KycUploadTokens, SubmitKycPayload, KycVerificationResponse } from './types';

import { kycUploadTokensSchema, kycVerificationResponseSchema } from './schemas';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',

  timeout: 10000,
});

/**
 * Returns the Authorization header
 * for authenticated requests.
 */
const authHeaders = () => {
  const token = getToken();

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
};

/**
 * Converts Axios errors into
 * readable user-facing messages.
 */
function messageFrom(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;

    if (Array.isArray(message)) {
      return message.join(', ');
    }

    if (typeof message === 'string') {
      return message;
    }

    if (!error.response) {
      return 'Unable to connect to the server.';
    }
  }

  return 'Something went wrong.';
}

/**
 * Requests secure upload URLs
 * for both required KYC assets.
 *
 * POST /kyc/upload-urls
 */
export async function getKycUploadUrls(
  documentContentType: string,
  faceScanContentType: string,
): Promise<KycUploadTokens> {
  try {
    const { data } = await api.post(
      '/kyc/upload-urls',
      {
        documentContentType,
        faceScanContentType,
      },
      {
        headers: authHeaders(),
      },
    );

    return kycUploadTokensSchema.parse(data);
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

/**
 * Uploads a file directly to
 * Cloudflare R2 / Amazon S3.
 */
export async function uploadToStorage(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed (${response.status}).`);
  }
}

/**
 * Submits uploaded storage keys
 * for AI verification.
 *
 * POST /kyc/verifications
 */
export async function submitKycVerification(
  payload: SubmitKycPayload,
): Promise<KycVerificationResponse> {
  try {
    const { data } = await api.post('/kyc/verifications', payload, {
      headers: authHeaders(),
    });

    return kycVerificationResponseSchema.parse(data);
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}
