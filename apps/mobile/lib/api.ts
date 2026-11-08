import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '../api/client';
import { toApiError } from './api-error';

export { apiClient };

/** GET a path; failures arrive as ApiError. */
export async function get<T>(path: string, params?: AxiosRequestConfig['params']): Promise<T> {
  try {
    const { data } = await apiClient.get<T>(path, { params });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

/** POST, PATCH, PUT or DELETE a path with an optional JSON body; failures arrive as ApiError. */
export async function send<T = unknown>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  try {
    const { data } = await apiClient.request<T>({ method, url: path, data: body, headers });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

/** A file picked on the phone, as expo-document-picker and expo-image-picker describe it. */
export type PickedFile = { uri: string; name: string; mimeType?: string | null; size?: number | null };

/** Multipart POST of one file plus fields; failures arrive as ApiError. */
export async function upload<T>(
  path: string,
  file: PickedFile,
  fields: Record<string, string> = {},
  fieldName = 'file',
): Promise<T> {
  const form = new FormData();
  // React Native's FormData takes { uri, name, type } for a file part.
  form.append(fieldName, { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as never);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  try {
    const { data } = await apiClient.post<T>(path, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

/** Uploads an attachment and returns its public URL (CVs, deliverables, logos, licences). */
export async function uploadFile(file: PickedFile): Promise<string> {
  const data = await upload<{ publicUrl?: string }>('/uploads/file', file, { hasConsentedToProcessing: 'true' });
  if (!data.publicUrl) throw toApiError(new Error('Upload failed'));
  return data.publicUrl;
}
