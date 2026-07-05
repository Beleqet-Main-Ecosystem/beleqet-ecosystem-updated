"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  MapPin,
  Send,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/auth";
import { useAuth } from "@/components/AuthProvider";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
type Category = { id: string; label: string };

export default function PostJobPage() {
  const { user, ready } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [publishedId, setPublishedId] = useState("");
  const [hasCompany, setHasCompany] = useState<boolean | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyCheckError, setCompanyCheckError] = useState("");
  useEffect(() => {
    fetch(`${API_URL}/jobs/categories`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setCategories)
      .catch(() => setError("Job categories could not be loaded."));
  }, []);

  const checkCompany = useCallback(async () => {
    setCompanyCheckError("");
    try {
      const response = await authenticatedFetch(`${API_URL}/users/company`, {
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session has expired. Please sign in again."
            : "Your company profile could not be checked.",
        );
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      setHasCompany(Boolean(data));
    } catch (err) {
      setCompanyCheckError(
        err instanceof Error && err.name !== "TimeoutError"
          ? err.message
          : "The server took too long to respond. Please try again.",
      );
    }
  }, []);

  useEffect(() => {
    if (!ready || !user || !["EMPLOYER", "ADMIN"].includes(user.role)) return;
    checkCompany();
  }, [ready, user, checkCompany]);

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCompanyLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await authenticatedFetch(`${API_URL}/users/company`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          industry: form.get("industry"),
          location: form.get("location"),
          website: form.get("website") || undefined,
          description: form.get("description"),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message || "Company profile could not be created.",
        );
      setHasCompany(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Company profile could not be created.",
      );
    } finally {
      setCompanyLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const number = (key: string) => {
      const value = form.get(key)?.toString();
      return value ? Number(value) : undefined;
    };
    const payload = {
      title: form.get("title"),
      description: form.get("description"),
      requirements: form.get("requirements"),
      location: form.get("location"),
      type: form.get("type"),
      categoryId: form.get("categoryId"),
      salaryMin: number("salaryMin"),
      salaryMax: number("salaryMax"),
      deadline: form.get("deadline") || undefined,
      vacancies: number("vacancies"),
      experienceLevel: form.get("experienceLevel") || undefined,
      applyEmail: form.get("applyEmail") || undefined,
      tags: form
        .get("tags")
        ?.toString()
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    };
    try {
      const response = await authenticatedFetch(`${API_URL}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join(", ")
            : data.message || "Job could not be published.",
        );
      setPublishedId(data.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Job could not be published.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (ready && !user)
    return (
      <Gate
        title="Sign in to post a job"
        text="Employer accounts can create and manage verified job listings."
        action="Sign in"
        href="/login"
      />
    );
  if (ready && user && !["EMPLOYER", "ADMIN"].includes(user.role))
    return (
      <Gate
        title="An employer account is required"
        text="Your current account cannot publish job listings. Register with the Employer role to continue."
        action="Create employer account"
        href="/register"
      />
    );
  if (ready && user && hasCompany === null && companyCheckError)
    return (
      <div className="container-page py-24 text-center">
        <p className="font-semibold text-redAccent">{companyCheckError}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={checkCompany}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-brandGreen"
          >
            Try again
          </button>
          {companyCheckError.includes("expired") && (
            <Link
              href="/login?next=/post-job"
              className="rounded-full border border-primary/15 px-5 py-2.5 text-sm font-bold text-primary"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    );
  if (!ready || (ready && user && hasCompany === null))
    return (
      <div
        role="status"
        className="container-page py-24 text-center text-sm font-semibold text-muted"
      >
        Loading employer workspace… This can take up to a minute while the server wakes up.
      </div>
    );
  if (ready && user && hasCompany === false)
    return (
      <div className="bg-[#f7f5ef] py-16">
        <div className="container-page max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-brandGreen">
            First-time setup
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-primary">
            Create your company profile
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Every published job belongs to a real company record. Complete this
            once, then continue to your listing.
          </p>
          <form
            onSubmit={createCompany}
            className="mt-8 space-y-4 rounded-[24px] border border-primary/10 bg-white p-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="name" label="Company name" placeholder="e.g. Acme Ethiopia" required />
              <Field name="industry" label="Industry" placeholder="e.g. Financial technology" required />
              <Field name="location" label="Location" placeholder="e.g. Addis Ababa, Ethiopia" required />
              <Field name="website" label="Website" type="url" placeholder="https://example.com" />
            </div>
            <TextArea name="description" label="Company description" placeholder="Briefly describe your company, mission, and work culture…" required />
            {error && (
              <p className="rounded-xl bg-redAccent/10 p-3 text-sm font-semibold text-redAccent">
                {error}
              </p>
            )}
            <button
              disabled={companyLoading}
              className="w-full rounded-full bg-primary py-3.5 text-sm font-bold text-white hover:bg-brandGreen disabled:opacity-60"
            >
              {companyLoading ? "Saving…" : "Save company and continue"}
            </button>
          </form>
        </div>
      </div>
    );
  if (publishedId)
    return (
      <div className="container-page py-24 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-brandGreen" />
        <h1 className="mt-5 text-3xl font-black text-primary">Job published</h1>
        <p className="mt-2 text-muted">
          The listing is now stored and available to job seekers.
        </p>
        <Link
          href={`/jobs/${publishedId}`}
          className="mt-7 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-white"
        >
          View listing
        </Link>
      </div>
    );

  return (
    <div className="bg-[#f7f5ef]">
      <section className="bg-primary py-14 text-white">
        <div className="container-page">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
            Employer workspace
          </p>
          <h1 className="mt-3 text-[clamp(2.8rem,6vw,5rem)] font-black leading-none tracking-[-.055em]">
            Find your next
            <br />
            great hire.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-white/60">
            Create a complete listing. Published jobs are saved directly to
            Beleqet and become searchable immediately.
          </p>
        </div>
      </section>
      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_300px]">
        <form onSubmit={submit} className="space-y-5">
          <FormSection icon={BriefcaseBusiness} title="Role details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="title" label="Job title" placeholder="e.g. Senior Backend Engineer" required />
              <Select name="categoryId" label="Category" required>
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Field name="location" label="Location" placeholder="e.g. Addis Ababa or Remote" required />
              <Select name="type" label="Work type" required>
                <option value="FULL_TIME">Full time</option>
                <option value="PART_TIME">Part time</option>
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="CONTRACT">Contract</option>
              </Select>
              <Select name="experienceLevel" label="Experience level">
                <option value="">Not specified</option>
                <option>Entry level</option>
                <option>Mid level</option>
                <option>Senior</option>
                <option>Leadership</option>
              </Select>
              <Field
                name="vacancies"
                label="Number of vacancies"
                type="number"
                min="1"
                defaultValue="1"
              />
            </div>
          </FormSection>
          <FormSection icon={FileText} title="Job description">
            <TextArea
              name="description"
              label="Responsibilities and role overview"
              placeholder="Describe the role's purpose and key responsibilities…"
              required
            />
            <TextArea
              name="requirements"
              label="Requirements and qualifications"
              placeholder="List the required experience, education, and qualifications…"
              required
            />
            <Field name="tags" label="Skills (comma separated)" placeholder="e.g. Node.js, PostgreSQL, TypeScript" />
          </FormSection>
          <FormSection
            icon={CircleDollarSign}
            title="Compensation and application"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="salaryMin"
                label="Minimum salary (ETB)"
                type="number"
                min="0"
              />
              <Field
                name="salaryMax"
                label="Maximum salary (ETB)"
                type="number"
                min="0"
              />
              <Field name="deadline" label="Application deadline" type="date" />
              <Field
                name="applyEmail"
                label="Application email"
                type="email"
                placeholder="jobs@example.com"
              />
            </div>
          </FormSection>
          {error && (
            <div
              role="alert"
              className="rounded-2xl bg-redAccent/10 p-4 text-sm font-semibold text-redAccent"
            >
              {error}
              {error.includes("company profile") && (
                <Link href="/profile" className="ml-1 underline">
                  Open profile
                </Link>
              )}
            </div>
          )}
          <button
            disabled={loading || !categories.length}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-sm font-bold text-white hover:bg-brandGreen disabled:opacity-60"
          >
            {loading ? "Publishing…" : "Publish job"}
            <Send className="h-4 w-4" />
          </button>
        </form>
        <aside className="space-y-4">
          <Tip
            icon={CheckCircle2}
            title="Complete listings perform better"
            text="Include clear responsibilities, requirements, location, and salary information."
          />
          <Tip
            icon={MapPin}
            title="Be specific"
            text="Use the actual work location or select Remote when appropriate."
          />
        </aside>
      </div>
    </div>
  );
}

function Gate({
  title,
  text,
  action,
  href,
}: {
  title: string;
  text: string;
  action: string;
  href: string;
}) {
  return (
    <div className="container-page py-24 text-center">
      <BriefcaseBusiness className="mx-auto h-12 w-12 text-brandGreen" />
      <h1 className="mt-5 text-3xl font-black text-primary">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">{text}</p>
      <Link
        href={href}
        className="mt-7 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-white"
      >
        {action}
      </Link>
    </div>
  );
}
function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof BriefcaseBusiness;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-primary/10 bg-white p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#d8ff3e] text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="font-extrabold text-primary">{title}</h2>
      </div>
      {children}
    </section>
  );
}
const control =
  "mt-1.5 w-full rounded-xl border border-primary/10 bg-white px-3.5 py-3 text-sm outline-none focus:border-brandGreen";
function Field({
  name,
  label,
  type,
  required,
  min,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  min?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-bold text-ink">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        min={min}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={control}
      />
    </label>
  );
}
function Select({
  name,
  label,
  required,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-ink">
      {label}
      <select name={name} required={required} className={control}>
        {children}
      </select>
    </label>
  );
}
function TextArea({
  name,
  label,
  required,
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="mb-4 block text-xs font-bold text-ink">
      {label}
      <textarea
        name={name}
        required={required}
        minLength={20}
        rows={6}
        placeholder={placeholder}
        className={control}
      />
    </label>
  );
}
function Tip({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof CheckCircle2;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-5">
      <Icon className="h-5 w-5 text-brandGreen" />
      <h3 className="mt-3 text-sm font-extrabold text-primary">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
    </div>
  );
}
