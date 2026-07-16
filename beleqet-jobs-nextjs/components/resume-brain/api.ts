import axios from 'axios';
import { getToken } from '@/lib/auth';
import { ExtractedResume, ResumeUploadRecord, UploadResumeResponse } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Uploads a CV file for AI-assisted parsing.
 *
 * @param file - The CV file (PDF/DOC/DOCX) selected by the user.
 * @param consent - Explicit GDPR consent to process the file's personal data.
 * @param onProgress - Called with 0-100 as the upload progresses.
 */
export async function uploadResume(
  file: File,
  consent: boolean,
  onProgress?: (percent: number) => void,
): Promise<UploadResumeResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('consent', String(consent));

  const { data } = await axios.post<UploadResumeResponse>(`${API_URL}/resumes/upload`, formData, {
    headers: { ...authHeaders() },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
  return data;
}

/** Retrieves a previously uploaded CV's stored metadata and parsed result. */
export async function getResume(id: string): Promise<ResumeUploadRecord> {
  const { data } = await axios.get<ResumeUploadRecord>(`${API_URL}/resumes/${id}`, {
    headers: authHeaders(),
  });
  return data;
}

/** Permanently deletes a resume and its parsed data (GDPR right-to-erasure). */
export async function deleteResume(id: string): Promise<void> {
  await axios.delete(`${API_URL}/resumes/${id}`, { headers: authHeaders() });
}

/**
 * Applies a parsed resume's data onto the given user's profile.
 *
 * @param userId - The profile owner's user ID.
 * @param resumeId - `ParsedResume` ID to source data from.
 * @param overrides - Corrected personal info / skills from the review form; when
 *   provided, these are applied instead of the originally stored parsed values.
 */
export async function autofillProfile(
  userId: string,
  resumeId: string,
  overrides?: { personalInfo?: ExtractedResume['personalInfo']; skills?: string[] },
): Promise<unknown> {
  const { data } = await axios.patch(
    `${API_URL}/profiles/${userId}/autofill`,
    { resumeId, ...overrides },
    { headers: authHeaders() },
  );
  return data;
}

/** Extracts a human-readable message from a failed API call. */
function isAxiosErrorLike(
  error: unknown,
): error is { isAxiosError?: boolean; response?: { data?: { message?: string | string[] } } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('isAxiosError' in error || axios.isAxiosError(error))
  );
}

export function messageFromResumeBrainError(error: unknown, fallback: string): string {
  if (isAxiosErrorLike(error) && error.isAxiosError) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }
  return fallback;
}
