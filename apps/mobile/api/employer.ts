/** Employer data: their jobs, applicants, company, plan. Same calls as the website's employer dashboard. */
import { get, send } from '../lib/api';
import type { ApplicationStatus } from './seeker';

export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';

export type EmployerJob = {
  id: string;
  title: string;
  location: string;
  status: JobStatus;
  deadline: string | null;
  createdAt?: string;
  _count?: { applications: number };
  // Full fields, for editing.
  categoryId?: string;
  vacancies?: number | null;
  type?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryType?: string | null;
  description?: string;
  requirements?: string | null;
  experienceLevel?: string | null;
  yearsOfExperience?: string | null;
  qualification?: string | null;
  tags?: string[];
  featured?: boolean;
  urgent?: boolean;
};

export type JobInput = Record<string, unknown>;
export const createJob = (job: JobInput) => send<{ id: string }>('POST', '/jobs', job);
export const updateJob = (id: string, job: JobInput) => send<{ id: string }>('PATCH', `/jobs/${encodeURIComponent(id)}`, job);

export const fetchMyJobs = () => get<EmployerJob[]>('/jobs/my');
/** Close, reopen or publish; `filled` records that the job was filled through Beleqet. */
export const setJobStatus = (id: string, status: JobStatus, filled?: boolean) =>
  send('PATCH', `/jobs/${encodeURIComponent(id)}`, filled === undefined ? { status } : { status, filled });

/** Job posts used in this plan period; max is null on unlimited plans. */
export type Quota = { plan: string; used: number; max: number | null; canFeature: boolean };
export const fetchQuota = () => get<Quota>('/jobs/my/quota');

export type Applicant = {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  coverLetter?: string;
  resumeUrl?: string;
  expectedSalary?: number;
  portfolioUrl?: string;
  user: { id: string; firstName: string; lastName: string; email: string; skills?: string[] };
  score?: { overallScore: number; summary?: string };
};

export const STAGES: ApplicationStatus[] = ['SUBMITTED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED'];
export const fetchApplicants = (jobId: string) => get<Applicant[]>(`/applications/job/${encodeURIComponent(jobId)}`);
export const moveApplicant = (id: string, status: ApplicationStatus) => send('PATCH', `/applications/${encodeURIComponent(id)}/status`, { status });
export const autoSchedule = (applicationId: string) => send('POST', '/interview-planner/auto-schedule', { applicationId });

// ── Company ────────────────────────────────────────────────────────────────────

export type Company = {
  id: string;
  name: string;
  description?: string | null;
  website?: string | null;
  industry?: string | null;
  size?: string | null;
  location?: string | null;
  logoUrl?: string | null;
  verified?: boolean;
  verificationStatus?: string | null;
  tradeLicenseUrl?: string | null;
};

/** The employer's company, or null before they create one (the API answers with an empty body). */
export const fetchCompany = async () => ((await get<Company | '' | null>('/users/company')) || null) as Company | null;
export const createCompany = (company: { name: string; industry: string; location: string; website?: string; description: string }) => send<Company>('POST', '/users/company', company);
export const saveCompany = (changes: Partial<Company>) => send<Company>('PATCH', '/users/company', changes);
export const submitLicence = (tradeLicenseUrl: string) => send<Partial<Company>>('POST', '/users/company/verification', { tradeLicenseUrl });
