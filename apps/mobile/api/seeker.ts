/** Job seeker data: applications, profile, the personal feed. Same calls as the website dashboard. */
import { get, send } from '../lib/api';
import { toJob, type Job } from './jobs';

export type ApplicationStatus = 'SUBMITTED' | 'SCREENING' | 'SHORTLISTED' | 'INTERVIEW_SCHEDULED' | 'OFFERED' | 'REJECTED' | 'WITHDRAWN';

export type Application = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  interviewSlot: string | null;
  createdAt: string;
  coverLetter?: string | null;
  resumeUrl?: string | null;
  job: { id: string; title: string; location?: string; company?: { name?: string; userId?: string } | null };
};

export const fetchApplications = () => get<Application[]>('/applications/my');
export const withdrawApplication = (id: string) => send('PATCH', `/applications/${encodeURIComponent(id)}/withdraw`);

/** Statuses still in play (counted as "in review"). */
export const ACTIVE_STATUSES: ApplicationStatus[] = ['SUBMITTED', 'SCREENING', 'SHORTLISTED'];

export type Profile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  defaultResumeUrl: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  skills: string[];
  gdprConsent: boolean;
  emailVerified: boolean;
  avatarUrl: string | null;
  telegramId?: string | null;
  createdAt?: string;
};

export const fetchProfile = () => get<Profile>('/users/profile');
export const updateProfile = (changes: Partial<Profile>) => send<Profile>('PATCH', '/users/profile', changes);

/** Share of the fields employers look at that are filled in. Same checks as the website. */
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

/** Why the feed picked a job: matching skills, recent searches, or saved jobs. */
export type FeedReason = { kind: string; terms: string[] };
export type FeedJob = Job & { reasons: FeedReason[] };

/** The personalised "Jobs for you" feed. */
export async function fetchFeed(limit = 10): Promise<FeedJob[]> {
  const rows = await get<Record<string, unknown>[]>('/ai-feed', { limit });
  return Array.isArray(rows) ? rows.map((row) => ({ ...toJob(row), reasons: (row.reasons as FeedReason[]) ?? [] })) : [];
}

export type FeedSignals = { personalised: boolean; skills: string[]; searches: string[] };
export const fetchFeedSignals = () => get<FeedSignals>('/ai-feed/signals');
export const hideFromFeed = (jobId: string) => send('POST', `/ai-feed/hidden/${encodeURIComponent(jobId)}`);

// ── Job alerts ─────────────────────────────────────────────────────────────────

export type JobAlert = { id: string; keywords: string[]; location: string | null; jobType: string | null; minSalary: number | null; isActive: boolean };
export const fetchAlerts = () => get<JobAlert[]>('/job-alerts');
export const createAlert = (alert: { keywords: string[]; location?: string; jobType?: string; minSalary?: number }) => send<JobAlert>('POST', '/job-alerts', alert);
export const setAlertActive = (id: string, isActive: boolean) => send('PATCH', `/job-alerts/${encodeURIComponent(id)}`, { isActive });
export const deleteAlert = (id: string) => send('DELETE', `/job-alerts/${encodeURIComponent(id)}`);
