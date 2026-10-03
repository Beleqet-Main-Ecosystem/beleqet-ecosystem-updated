import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  Building2,
  ArrowLeft,
  CheckCircle2,
  Calendar,
  Briefcase,
  Users,
  Banknote,
  GraduationCap,
  Sparkles,
  Flame,
  Globe,
  Share2,
  Bookmark,
} from 'lucide-react';
import { fetchJob, fetchJobs, type Job } from '@/lib/api';
import JobActions from '@/components/JobActions';
import SaveJobButton from '@/components/SaveJobButton';
import { jobDetailPageMetadata } from '@/lib/seo/generate-metadata';
import { JobPostingSchema, BreadcrumbSchema } from '@/lib/seo/schemas';

export const revalidate = 300;

function formatCurrency(amount: number, currency: string = 'ETB') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const job = await fetchJob(params.id);
  if (!job) {
    return jobDetailPageMetadata({
      id: params.id,
      title: 'Job Not Found',
      company: '',
      location: '',
    });
  }
  return jobDetailPageMetadata(job);
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await fetchJob(params.id);
  if (!job) notFound();

  const all = await fetchJobs();
  const related = all.filter((j) => j.category === job.category && j.id !== job.id).slice(0, 4);

  const hasSalary = job.salaryMin != null || job.salaryMax != null;

  // Split requirements text into structured bullet items if available
  const requirementsList = job.requirements
    ? job.requirements
        .split('\n')
        .map((r) => r.trim().replace(/^[•\-\*]\s*/, ''))
        .filter(Boolean)
    : [];

  return (
    <div className="container-page py-10">
      <JobPostingSchema
        job={{
          id: job.id,
          title: job.title,
          description: job.description ?? '',
          datePosted: job.createdAt ?? new Date().toISOString(),
          company: job.company,
          location: job.location,
          employmentType: job.type,
        }}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Jobs', href: '/jobs' },
          { name: job.title, href: `/jobs/${job.id}` },
        ]}
      />

      {/* Back button */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brandGreen transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to all jobs
        </Link>
        <div className="flex items-center gap-2">
          <SaveJobButton jobId={job.id} light={true} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* Main Job Details Column */}
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-3xl border border-border bg-white p-7 sm:p-9 shadow-card">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              {job.companyLogo ? (
                <img
                  src={job.companyLogo}
                  alt={`${job.company} logo`}
                  className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl border border-border/80 object-cover bg-white shadow-sm"
                />
              ) : (
                <span className="inline-flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-brandGreen/10 text-brandGreen font-bold">
                  <Building2 className="h-8 w-8" />
                </span>
              )}

              <div className="flex-1 min-w-0">
                {/* Badges row */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {job.featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brandGreen text-white px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                      <Sparkles className="h-3 w-3" /> Featured
                    </span>
                  )}
                  {job.urgent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-600 px-2.5 py-0.5 text-xs font-bold uppercase">
                      <Flame className="h-3 w-3" /> Urgent Hiring
                    </span>
                  )}
                  <span className="rounded-full bg-primary/5 text-ink font-semibold px-2.5 py-0.5 text-xs">
                    {job.type}
                  </span>
                  {job.categoryLabel && (
                    <span className="rounded-full bg-blue-50 text-blue-700 font-semibold px-2.5 py-0.5 text-xs">
                      {job.categoryLabel}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-ink leading-tight">
                  {job.title}
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-ink">
                    <span>{job.company}</span>
                    {job.companyVerified && (
                      <span className="inline-flex items-center gap-0.5 text-blue-600 text-xs font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3.5 w-3.5 fill-blue-500 text-white" />
                        Verified
                      </span>
                    )}
                  </div>
                  {job.companyWebsite && (
                    <a
                      href={job.companyWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-brandGreen underline"
                    >
                      <Globe className="h-3 w-3" /> Visit website
                    </a>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-brandGreen" /> {job.location}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-brandGreen" /> Posted {job.postedAgo}
                  </span>
                  {job.expiryDate && (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                      <Calendar className="h-3.5 w-3.5" /> Deadline: {job.expiryDate}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Specs Highlight Grid */}
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border pt-6">
              <div className="rounded-2xl bg-pageBg/70 p-3.5 border border-border/40">
                <div className="flex items-center gap-2 text-xs font-medium text-muted mb-1">
                  <Banknote className="h-4 w-4 text-brandGreen" /> Salary
                </div>
                <div className="text-sm font-bold text-ink">
                  {hasSalary ? (
                    <>
                      {job.salaryMin != null && formatCurrency(job.salaryMin, job.currency)}
                      {job.salaryMin != null && job.salaryMax != null && ' – '}
                      {job.salaryMax != null && formatCurrency(job.salaryMax, job.currency)}
                    </>
                  ) : (
                    'Negotiable'
                  )}
                </div>
                <div className="text-[11px] text-muted">{job.salaryType ?? 'Monthly'}</div>
              </div>

              <div className="rounded-2xl bg-pageBg/70 p-3.5 border border-border/40">
                <div className="flex items-center gap-2 text-xs font-medium text-muted mb-1">
                  <Briefcase className="h-4 w-4 text-brandGreen" /> Job Type
                </div>
                <div className="text-sm font-bold text-ink">{job.type}</div>
                <div className="text-[11px] text-muted">{job.location}</div>
              </div>

              <div className="rounded-2xl bg-pageBg/70 p-3.5 border border-border/40">
                <div className="flex items-center gap-2 text-xs font-medium text-muted mb-1">
                  <GraduationCap className="h-4 w-4 text-brandGreen" /> Experience
                </div>
                <div className="text-sm font-bold text-ink truncate">
                  {job.experienceLevel || 'Not specified'}
                </div>
                <div className="text-[11px] text-muted">Required level</div>
              </div>

              <div className="rounded-2xl bg-pageBg/70 p-3.5 border border-border/40">
                <div className="flex items-center gap-2 text-xs font-medium text-muted mb-1">
                  <Users className="h-4 w-4 text-brandGreen" /> Vacancies
                </div>
                <div className="text-sm font-bold text-ink">
                  {job.vacancies ? `${job.vacancies} open position${job.vacancies > 1 ? 's' : ''}` : '1 position'}
                </div>
                <div className="text-[11px] text-muted">Hiring quota</div>
              </div>
            </div>
          </div>

          {/* Job Description Card */}
          <div className="rounded-3xl border border-border bg-white p-7 sm:p-9 shadow-card space-y-7">
            <div>
              <h2 className="text-lg font-bold text-ink mb-3 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-brandGreen" /> Role Overview
              </h2>
              <div className="text-sm text-ink/80 leading-relaxed whitespace-pre-line">
                {job.description}
              </div>
            </div>

            {/* Key Requirements & Qualifications */}
            {requirementsList.length > 0 && (
              <div className="border-t border-border pt-6">
                <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-brandGreen" /> Key Requirements & Qualifications
                </h2>
                <ul className="space-y-2.5">
                  {requirementsList.map((req, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-ink/80">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brandGreen" />
                      <span className="leading-relaxed">{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skills & Technologies Tags */}
            {job.tags && job.tags.length > 0 && (
              <div className="border-t border-border pt-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
                  Skills & Technologies
                </h2>
                <div className="flex flex-wrap gap-2">
                  {job.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-xl border border-border bg-pageBg px-3.5 py-1.5 text-xs font-semibold text-ink"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Company Profile Card */}
          {job.companyDescription && (
            <div className="rounded-3xl border border-border bg-white p-7 sm:p-9 shadow-card">
              <h2 className="text-lg font-bold text-ink mb-3">About {job.company}</h2>
              <p className="text-sm text-muted leading-relaxed mb-4">{job.companyDescription}</p>

              <div className="flex flex-wrap gap-4 text-xs text-ink/70 border-t border-border pt-4">
                {job.companyIndustry && (
                  <div>
                    <span className="text-muted block text-[11px]">Industry</span>
                    <span className="font-semibold">{job.companyIndustry}</span>
                  </div>
                )}
                {job.companySize && (
                  <div>
                    <span className="text-muted block text-[11px]">Company Size</span>
                    <span className="font-semibold">{job.companySize}</span>
                  </div>
                )}
                {job.location && (
                  <div>
                    <span className="text-muted block text-[11px]">Headquarters</span>
                    <span className="font-semibold">{job.location}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Column */}
        <aside className="space-y-6">
          {/* Action Box */}
          <div className="sticky top-6 space-y-6">
            <JobActions jobId={job.id} />

            {/* Similar / Related Jobs */}
            {related.length > 0 && (
              <div className="rounded-2xl border border-border bg-white p-6 shadow-card">
                <h3 className="text-sm font-bold text-ink mb-4 flex items-center justify-between">
                  <span>Similar Opportunities</span>
                  <Link href={`/jobs?category=${job.category}`} className="text-xs text-brandGreen hover:underline font-semibold">
                    View all
                  </Link>
                </h3>
                <div className="space-y-3.5 divide-y divide-border/60">
                  {related.map((r) => (
                    <Link
                      key={r.id}
                      href={`/jobs/${r.id}`}
                      className="group block pt-3 first:pt-0"
                    >
                      <p className="text-sm font-semibold text-ink group-hover:text-brandGreen transition-colors line-clamp-1">
                        {r.title}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {r.company} · {r.location}
                      </p>
                      {r.salaryMin != null && (
                        <p className="text-xs font-semibold text-brandGreen mt-1">
                          {formatCurrency(r.salaryMin, r.currency)}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
