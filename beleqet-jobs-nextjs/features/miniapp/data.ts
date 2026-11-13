import { authenticatedFetch } from '@/lib/auth';
import { toDisplayJob, type Job } from '@/lib/api';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

/** One job, signed in when possible (an employer sees their own job while it waits for review). Null: not found. */
export async function fetchMiniAppJob(id: string): Promise<Job | null> {
  const response = await authenticatedFetch(`${API_URL}/jobs/${encodeURIComponent(id)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET /jobs/${id}: ${response.status}`);
  return toDisplayJob(await response.json());
}
