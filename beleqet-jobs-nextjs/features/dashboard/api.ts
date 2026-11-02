import { authenticatedFetch } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

export async function apiGet<T>(path: string): Promise<T> {
  const response = await authenticatedFetch(`${API_URL}${path}`);
  if (!response.ok) throw new Error(`GET ${path}: ${response.status}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function apiSend<T = unknown>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(`${API_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export type ApplicationStatus = 'SUBMITTED' | 'SCREENING' | 'SHORTLISTED' | 'INTERVIEW_SCHEDULED' | 'OFFERED' | 'REJECTED' | 'WITHDRAWN';

export type Application = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  interviewSlot: string | null;
  createdAt: string;
  job: { id: string; title: string; location?: string; company?: { name?: string } | null };
};

export type Profile = {
  firstName: string;
  lastName: string;
  phone: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  defaultResumeUrl: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  skills: string[];
};

export const fetchApplications = () => apiGet<Application[]>('/applications/my');
export const fetchProfile = () => apiGet<Profile>('/users/profile');

/** Share of the fields employers look at that have been filled in. */
export function profileChecks(profile: Profile) {
  return [
    { key: 'headline', done: Boolean(profile.headline) },
    { key: 'summary', done: Boolean(profile.bio) },
    { key: 'location', done: Boolean(profile.location) },
    { key: 'phone', done: Boolean(profile.phone) },
    { key: 'skills', done: profile.skills.length > 0 },
    { key: 'cv', done: Boolean(profile.defaultResumeUrl) },
  ];
}
