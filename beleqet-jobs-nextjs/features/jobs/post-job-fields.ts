import { jobGender, type Gender } from './format';
import type { JobTypeCode } from './search-params';

/** The job form's choices and rules, shared by the website form and the Mini App's steps. */
export const PAY_PERIODS = ['monthly', 'daily', 'hourly'] as const;
export type PayPeriod = (typeof PAY_PERIODS)[number];
export const LEVELS = ['Entry level', 'Junior', 'Mid-level', 'Senior'] as const;
export const MIN_DESCRIPTION = 50;

/** One of the employer's own jobs, as GET /jobs/my returns it. */
export type SavedJob = {
  id: string;
  title: string;
  categoryId: string;
  location: string;
  vacancies: number | null;
  type: JobTypeCode;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryType: string | null;
  description: string;
  requirements: string | null;
  experienceLevel: string | null;
  yearsOfExperience: string | null;
  qualification: string | null;
  gender: string | null;
  tags: string[];
  applyType: string | null;
  applyUrl: string | null;
  applyEmail: string | null;
  deadline: string | null;
  featured: boolean;
  urgent: boolean;
};

/** The form as typed: numbers stay text until the job is sent. */
export type JobFields = {
  title: string;
  categoryId: string;
  location: string;
  vacancies: string;
  gender: Gender;
  type: JobTypeCode;
  salaryMin: string;
  salaryMax: string;
  salaryType: PayPeriod;
  description: string;
  requirements: string;
  experienceLevel: string;
  years: string;
  qualification: string;
  tags: string[];
  deadline: string;
  featured: boolean;
  urgent: boolean;
};

export const EMPTY_FIELDS: JobFields = {
  title: '',
  categoryId: '',
  location: '',
  vacancies: '1',
  gender: 'ANY',
  type: 'FULL_TIME',
  salaryMin: '',
  salaryMax: '',
  salaryType: 'monthly',
  description: '',
  requirements: '',
  experienceLevel: '',
  years: '',
  qualification: '',
  tags: [],
  deadline: '',
  featured: false,
  urgent: false,
};

export function fieldsFromJob(job: SavedJob): JobFields {
  return {
    title: job.title,
    categoryId: job.categoryId,
    location: job.location,
    vacancies: String(job.vacancies ?? 1),
    gender: jobGender(job.gender) ?? 'ANY',
    type: job.type,
    salaryMin: job.salaryMin ? String(job.salaryMin) : '',
    salaryMax: job.salaryMax ? String(job.salaryMax) : '',
    salaryType: PAY_PERIODS.find((item) => item === job.salaryType?.toLowerCase()) ?? 'monthly',
    description: job.description,
    requirements: job.requirements ?? '',
    experienceLevel: job.experienceLevel ?? '',
    years: job.yearsOfExperience ?? '',
    qualification: job.qualification ?? '',
    tags: job.tags ?? [],
    deadline: job.deadline ? job.deadline.slice(0, 10) : '',
    featured: job.featured,
    urgent: job.urgent,
  };
}

/** Checks in form order: the field each one is about, and the message key when it fails. */
const CHECKS: { field: keyof JobFields; key: string; fails: (f: JobFields) => boolean }[] = [
  { field: 'title', key: 'postJob.errTitle', fails: (f) => f.title.trim().length < 3 },
  { field: 'categoryId', key: 'postJob.errCategory', fails: (f) => !f.categoryId },
  { field: 'location', key: 'postJob.errLocation', fails: (f) => !f.location.trim() },
  {
    field: 'salaryMax',
    key: 'postJob.errSalary',
    fails: (f) => Boolean(Number(f.salaryMin) && Number(f.salaryMax) && Number(f.salaryMax) < Number(f.salaryMin)),
  },
  { field: 'description', key: 'postJob.errDescription', fails: (f) => f.description.trim().length < MIN_DESCRIPTION },
];

/** The first problem among `fields` (all of them when omitted), as a message key; '' when there is none. */
export function jobProblem(f: JobFields, fields?: (keyof JobFields)[]): string {
  return CHECKS.find((check) => (!fields || fields.includes(check.field)) && check.fails(f))?.key ?? '';
}

/**
 * The body for POST /jobs or PATCH /jobs/:id. An edit sends null so a field the employer emptied
 * is cleared, not left as it was. Applications always come through Beleqet, so saving an older job
 * also clears its link or email.
 */
export function jobRequestBody(f: JobFields, { editing, canFeature }: { editing: boolean; canFeature: boolean }) {
  const empty = editing ? null : undefined;
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    requirements: f.requirements.trim() || empty,
    location: f.location.trim(),
    type: f.type,
    categoryId: f.categoryId,
    salaryMin: Number(f.salaryMin) || empty,
    salaryMax: Number(f.salaryMax) || empty,
    salaryType: f.salaryType,
    vacancies: Number(f.vacancies) || 1,
    gender: f.gender,
    experienceLevel: f.experienceLevel || empty,
    yearsOfExperience: f.years.trim() || empty,
    qualification: f.qualification.trim() || empty,
    tags: f.tags,
    deadline: f.deadline || empty,
    applyType: empty,
    applyUrl: empty,
    applyEmail: empty,
    featured: canFeature ? f.featured : undefined,
    urgent: f.urgent,
  };
}
