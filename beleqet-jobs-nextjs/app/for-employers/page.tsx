import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  MessageSquare,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'For Employers | Hire Ethiopian Talent on Beleqet',
  description:
    'Post jobs, find verified candidates, and manage your hiring pipeline. Beleqet connects Ethiopian employers with qualified job seekers and freelancers.',
  alternates: { canonical: 'https://beleqetjobs.com/for-employers' },
};

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI Candidate Matching',
    body: 'Our AI surfaces the most relevant candidates based on your job description — not just keyword search.',
  },
  {
    icon: CheckCircle2,
    title: 'Verified Profiles',
    body: 'Every candidate profile is reviewed. You see real skills, real education, and real references.',
  },
  {
    icon: BarChart3,
    title: 'Applicant Dashboard',
    body: 'Track all applications, shortlist candidates, and communicate — in one clean interface.',
  },
  {
    icon: MessageSquare,
    title: 'Direct Messaging',
    body: 'Reach candidates directly without back-and-forth email chains.',
  },
  {
    icon: Shield,
    title: 'Escrow Freelance Hiring',
    body: 'Hire freelancers safely with BeleqetSafe Escrow — funds held until work is approved.',
  },
  {
    icon: Zap,
    title: 'Promoted Listings',
    body: 'Boost your job listing to the top of search results and reach more candidates faster.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Post your job',
    body: 'Create a listing in under 5 minutes. Salary transparency is required — it attracts better candidates.',
  },
  {
    n: '02',
    title: 'Review candidates',
    body: 'Qualified applicants appear in your dashboard. AI ranking puts the best matches at the top.',
  },
  {
    n: '03',
    title: 'Shortlist & interview',
    body: 'Save candidates, send messages, and schedule interviews — all inside Beleqet.',
  },
  {
    n: '04',
    title: 'Hire with confidence',
    body: 'Make your offer through the platform. For freelancers, fund escrow and release on approval.',
  },
];

export default function ForEmployersPage() {
  return (
    <div className="bg-[#f7f5ef] dark:bg-slate-950">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-primary py-20 text-white lg:py-28">
        <div className="absolute -right-24 -top-32 h-96 w-96 rounded-full border-[70px] border-[#d8ff3e]/10" />
        <div className="container-page relative">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
            For Employers
          </p>
          <h1 className="mt-5 max-w-4xl text-[clamp(2.8rem,7vw,6rem)] font-black leading-[.88] tracking-[-.06em]">
            Find the right person.
            <br />
            <span className="text-[#d8ff3e]">Faster than ever.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-base leading-7 text-white/60">
            Post jobs to thousands of active Ethiopian professionals. Screen, shortlist, and hire —
            all from one dashboard.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/post-job"
              className="inline-flex items-center gap-2 rounded-full bg-[#d8ff3e] px-7 py-3.5 text-sm font-bold text-primary transition-opacity hover:opacity-90"
            >
              Post a Job Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:border-[#d8ff3e] hover:text-[#d8ff3e]"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-b border-primary/10 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="container-page grid grid-cols-2 md:grid-cols-4">
          {[
            { icon: Users, value: '50K+', label: 'Active job seekers' },
            { icon: BriefcaseBusiness, value: '10K+', label: 'Job listings posted' },
            { icon: CheckCircle2, value: '98%', label: 'Profile verification rate' },
            { icon: Zap, value: '<24h', label: 'Average time to first applicant' },
          ].map((item) => (
            <div
              key={item.label}
              className="border-primary/10 p-7 even:border-l dark:border-slate-800 md:border-l first:md:border-l-0"
            >
              <item.icon className="h-5 w-5 text-[#d8ff3e]" />
              <p className="mt-5 text-3xl font-black tracking-tight text-primary dark:text-white">
                {item.value}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted dark:text-slate-400">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why Beleqet ── */}
      <section className="container-page py-20">
        <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
          Why Beleqet for hiring
        </p>
        <h2 className="mt-4 text-4xl font-black tracking-[-.04em] text-primary dark:text-white">
          Everything you need to hire right.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-[24px] border border-primary/10 bg-white p-7 dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#d8ff3e]/15 text-[#d8ff3e]">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mb-2 text-base font-bold text-primary dark:text-white">{title}</h3>
              <p className="text-sm leading-6 text-muted dark:text-slate-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-y border-primary/10 bg-white py-20 dark:border-slate-800 dark:bg-slate-900">
        <div className="container-page">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
            How it works
          </p>
          <h2 className="mt-4 text-4xl font-black tracking-[-.04em] text-primary dark:text-white">
            Hire in 4 steps.
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ n, title, body }) => (
              <div key={n} className="rounded-[24px] border border-primary/10 bg-[#f7f5ef] p-7 dark:border-slate-800 dark:bg-slate-800">
                <span className="text-4xl font-black text-primary/10 dark:text-white/10">{n}</span>
                <h3 className="mt-4 text-base font-bold text-primary dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted dark:text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="container-page py-20">
        <div className="relative overflow-hidden flex flex-col justify-between gap-7 rounded-[30px] bg-primary p-8 sm:p-12 lg:flex-row lg:items-center">
          {/* decorative ring */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border-[50px] border-[#d8ff3e]/10" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
              Ready to hire?
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
              Start hiring today.
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Your first job post is free. No credit card required.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/post-job"
              className="inline-flex items-center gap-2 rounded-full bg-[#d8ff3e] px-7 py-3.5 text-sm font-bold text-primary transition-opacity hover:opacity-90"
            >
              Post a Job Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/employer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:border-[#d8ff3e] hover:text-[#d8ff3e]"
            >
              Employer Dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
