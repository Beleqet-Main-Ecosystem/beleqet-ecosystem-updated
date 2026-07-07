"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Eye, Plus, Users } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
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
  user: { firstName: string; lastName: string; email: string };
};
const statuses = [
  "SUBMITTED",
  "SCREENING",
  "SHORTLISTED",
  "INTERVIEW_SCHEDULED",
  "OFFERED",
  "REJECTED",
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
    if (user && ["EMPLOYER", "ADMIN"].includes(user.role)) loadJobs();
  }, [user, loadJobs]);
  async function openApplicants(job: Job) {
    setSelected(job);
    const response = await authenticatedFetch(
      `${API_URL}/applications/job/${job.id}`,
    );
    if (response.ok) setApplicants(await response.json());
  }
  async function changeStatus(id: string, status: string) {
    const response = await authenticatedFetch(
      `${API_URL}/applications/${id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (response.ok && selected) openApplicants(selected);
  }
  if (!ready || !user || !["EMPLOYER", "ADMIN"].includes(user.role))
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
          <Metric
            label="Total jobs"
            value={jobs.length}
            icon={BriefcaseBusiness}
          />
          <Metric
            label="Published"
            value={jobs.filter((j) => j.status === "PUBLISHED").length}
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
            <h2 className="text-2xl font-black text-primary">
              Applicants · {selected.title}
            </h2>
            <div className="mt-4 space-y-3">
              {applicants.length ? (
                applicants.map((item) => (
                  <article key={item.id} className="rounded-2xl bg-white p-5">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row">
                      <div>
                        <h3 className="font-extrabold text-primary">
                          {item.user.firstName} {item.user.lastName}
                        </h3>
                        <p className="text-xs text-muted">
                          {item.user.email} ·{" "}
                          {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <select
                        value={item.status}
                        onChange={(e) => changeStatus(item.id, e.target.value)}
                        className="rounded-xl border border-border px-3 py-2 text-xs font-bold"
                      >
                        {statuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                    {item.coverLetter && (
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted">
                        {item.coverLetter}
                      </p>
                    )}
                    {item.resumeUrl && (
                      <a
                        href={item.resumeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 inline-flex text-xs font-bold text-brandGreen"
                      >
                        View resume
                      </a>
                    )}
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
