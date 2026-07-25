import type { EmailLog, EmailLogPage, EmailLogQuery } from '../types/email';
import apiClient from './apiClient';

const BASE_URL = '/admin/emails';

/** Strips undefined/empty fields so axios doesn't serialize them as literal "undefined" params. */
function cleanQuery(query: EmailLogQuery): Record<string, string | number> {
  const cleaned: Record<string, string | number> = {};
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') cleaned[key] = value as string | number;
  });
  return cleaned;
}

/** Fetches a paginated, filtered page of email dispatch logs. */
export async function fetchEmailLogs(query: EmailLogQuery): Promise<EmailLogPage> {
  const { data } = await apiClient.get<EmailLogPage>(`${BASE_URL}/logs`, {
    params: cleanQuery(query),
  });
  return data;
}

/** Fetches a single log's full detail, including error message and metadata. */
export async function fetchEmailLog(id: string): Promise<EmailLog> {
  const { data } = await apiClient.get<EmailLog>(`${BASE_URL}/logs/${id}`);
  return data;
}

/** Re-queues a failed (or any) email for another send attempt. */
export async function resendEmail(id: string): Promise<EmailLog> {
  const { data } = await apiClient.post<EmailLog>(`${BASE_URL}/logs/${id}/resend`);
  return data;
}
