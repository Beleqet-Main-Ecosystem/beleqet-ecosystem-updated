'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BriefcaseBusiness, Eye, Plus, Users, Sparkles, FileText, CheckCircle2, Calendar } from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
type Job = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  _count: { applications: number };
};
type Applicant = {
  id: string;
  status: string;
  createdAt: string;
  coverLetter?: string;
  resumeUrl?: string;
  expectedSalary?: number;
  user: {
    id?: string;
    firstName: string;
    lastName: string;
    email: string;
    skills?: string[];
  };
  score?: {
    overallScore: number;
    skillsScore?: number;
    experienceScore?: number;
    educationScore?: number;
    summary?: string;
  };
};
const statuses = [
  'SUBMITTED',
  'SCREENING',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'OFFERED',
  'REJECTED',
];

export default function EmployerPage() {
  const { user, ready } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<Job | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const loadJobs = useCallback(async () => {
    const response = await authenticatedFetch(`${API_URL}/jobs/my`);
    if (response.ok) setJobs(await response.json());
  }, []);
  useEffect(() => {
    if (user && ['EMPLOYER', 'ADMIN'].includes(user.role)) loadJobs();
  }, [user, loadJobs]);
  async function openApplicants(job: Job) {
    setSelected(job);
    const response = await authenticatedFetch(`${API_URL}/applications/job/${job.id}`);
    if (response.ok) setApplicants(await response.json());
  }
  async function changeStatus(id: string, status: string) {
    const response = await authenticatedFetch(`${API_URL}/applications/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (response.ok && selected) openApplicants(selected);
  }
  async function autoSchedule(applicationId: string) {
    try {
      const response = await authenticatedFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/interview-planner/auto-schedule`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            applicationId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message ?? 'Unable to schedule interview.');
        return;
      }

      toast.success(data.message ?? 'Interview scheduled successfully.');

      if (selected) {
        openApplicants(selected);
      }
    } catch (error) {
      console.error(error);

      toast.error('Failed to schedule interview. Please try again.');
    }
  }
  if (!ready || !user || !['EMPLOYER', 'ADMIN'].includes(user.role))
    return (
      <div className="container-page py-24 text-center text-muted">
        Employer access is required.
      </div>
    );
  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="bg-primary py-14 text-white">
        <div className="container-page flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
              Employer dashboard
            </p>
            <h1 className="mt-3 text-4xl font-black">Hiring workspace</h1>
          </div>
          <Link
            href="/post-job"
            className="flex items-center gap-2 rounded-full bg-[#d8ff3e] px-5 py-3 text-sm font-bold text-primary"
          >
            <Plus className="h-4 w-4" /> Post a job
          </Link>
        </div>
      </section>
      <div className="container-page py-10">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Total jobs" value={jobs.length} icon={BriefcaseBusiness} />
          <Metric
            label="Published"
            value={jobs.filter((j) => j.status === 'PUBLISHED').length}
            icon={Eye}
          />
          <Metric
            label="Applications"
            value={jobs.reduce((sum, job) => sum + job._count.applications, 0)}
            icon={Users}
          />
        </div>
        <div className="mt-8 overflow-x-auto rounded-2xl bg-white">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead>
              <tr className="bg-primary/5 text-xs uppercase text-muted">
                <th className="p-4">Job</th>
                <th>Status</th>
                <th>Applications</th>
                <th>Posted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-border">
                  <td className="p-4 font-bold text-primary">{job.title}</td>
                  <td>{job.status}</td>
                  <td>{job._count.applications}</td>
                  <td>{new Date(job.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => openApplicants(job)}
                      className="text-xs font-bold text-brandGreen"
                    >
                      Manage applicants
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selected && (
          <section className="mt-8">
            <h2 className="text-2xl font-black text-primary">Applicants · {selected.title}</h2>
            <div className="mt-4 space-y-3">
              {applicants.length ? (
                applicants.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-extrabold text-primary">
                            {item.user.firstName} {item.user.lastName}
                          </h3>
                          {item.score && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brandGreen/10 px-2.5 py-0.5 text-xs font-bold text-brandGreen">
                              <Sparkles className="h-3.5 w-3.5" />
                              {(item.score.overallScore > 10 ? item.score.overallScore / 10 : item.score.overallScore).toFixed(1)} / 10 AI Match
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {item.user.email} · Applied on {new Date(item.createdAt).toLocaleDateString()}
                          {item.expectedSalary && (
                            <span className="ml-2 font-semibold text-ink">
                              · Expected: ETB {item.expectedSalary.toLocaleString()}
                            </span>
                          )}
                        </p>

                        {/* AI Score breakdown sub-pills */}
                        {item.score && (
                          <div className="mt-2.5 flex flex-wrap gap-2 text-[11px]">
                            {item.score.skillsScore != null && (
                              <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                                Skills: {item.score.skillsScore}/10
                              </span>
                            )}
                            {item.score.experienceScore != null && (
                              <span className="rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                                Experience: {item.score.experienceScore}/10
                              </span>
                            )}
                            {item.score.summary && (
                              <span className="rounded-md bg-purple-50 px-2 py-0.5 font-medium text-purple-700">
                                {item.score.summary}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2.5 sm:items-end shrink-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted">Status:</span>
                          <select
                            value={item.status}
                            onChange={(e) => changeStatus(item.id, e.target.value)}
                            className="rounded-xl border border-border bg-pageBg px-3 py-2 text-xs font-bold text-ink outline-none focus:border-brandGreen"
                          >
                            {statuses.map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </div>

                        {item.status === 'SHORTLISTED' && (
                          <button
                            onClick={() => autoSchedule(item.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brandGreen px-4 py-2 text-xs font-bold text-white transition hover:bg-darkGreen shadow-sm"
                          >
                            <Calendar className="h-3.5 w-3.5" /> Schedule Interview
                          </button>
                        )}

                        {item.status === 'INTERVIEW_SCHEDULED' && (
                          <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Interview Scheduled
                          </span>
                        )}
                      </div>
                    </div>

                    {item.coverLetter && (
                      <div className="mt-4 rounded-xl bg-pageBg/60 p-4 border border-border/40">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-1">
                          Cover Letter
                        </span>
                        <p className="whitespace-pre-wrap text-xs leading-5 text-ink/80">
                          {item.coverLetter}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                      {item.resumeUrl ? (
                        <a
                          href={item.resumeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-brandGreen hover:underline"
                        >
                          <FileText className="h-4 w-4" /> View Submitted Resume
                        </a>
                      ) : (
                        <span className="text-xs text-muted">No resume attached</span>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-2xl bg-white p-10 text-center text-muted">
                  No applications for this job.
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl bg-white p-5">
      <Icon className="h-5 w-5 text-brandGreen" />
      <p className="mt-4 text-3xl font-black text-primary">{value}</p>
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
    </div>
  );
}
