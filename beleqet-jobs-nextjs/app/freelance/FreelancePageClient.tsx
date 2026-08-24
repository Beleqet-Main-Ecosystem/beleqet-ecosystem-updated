'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Lock,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

const CATEGORIES = [
  'Web & Mobile Dev',
  'Design & Creative',
  'Writing & Translation',
  'Marketing & SEO',
  'Data & Analytics',
  'Video & Animation',
  'Finance & Accounting',
  'Legal & Consulting',
];

const FEATURES = [
  {
    icon: Lock,
    title: 'Escrow-protected payments',
    description:
      'Funds are held securely in escrow until work is approved — clients and freelancers are both protected.',
  },
  {
    icon: CheckCircle2,
    title: 'Verified Ethiopian talent',
    description:
      'Every freelancer profile is reviewed. Skill badges are earned through assessments, not self-declaration.',
  },
  {
    icon: TrendingUp,
    title: 'AI-matched projects',
    description:
      'Our AI Matchmaker surfaces the right gigs for your skills and budget — saving hours of manual browsing.',
  },
  {
    icon: Users,
    title: 'Local & remote work',
    description:
      'Find talent across Addis Ababa and all regions, or post fully remote projects open to any Ethiopian freelancer.',
  },
];

export default function FreelancePageClient() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    router.push(`/feed?type=freelance&${params.toString()}`);
  }

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#fffdf8] dark:bg-slate-950">
        <div className="container-page relative py-20 lg:py-28">
          <div className="max-w-3xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-brandGreen/20 bg-brandGreen/5 px-3.5 py-2 text-xs font-bold text-brandGreen">
              <Sparkles className="h-3.5 w-3.5" /> Ethiopia&apos;s Freelance Marketplace
            </div>

            <h1 className="text-[clamp(2.6rem,6vw,5.5rem)] font-black leading-[.9] tracking-[-0.06em] text-primary dark:text-white">
              Hire top Ethiopian{' '}
              <span className="relative whitespace-nowrap text-brandGreen">
                freelancers
                <span className="absolute -bottom-1 left-1 h-2 w-[96%] -rotate-1 rounded-full bg-[#d8ff3e] -z-10" />
              </span>
              <br />& find great projects.
            </h1>

            <p className="mt-7 max-w-xl text-base leading-7 text-muted dark:text-slate-400 md:text-lg">
              Post freelance projects or offer your skills — with{' '}
              <strong className="font-semibold text-primary dark:text-white">
                Escrow-protected payments
              </strong>{' '}
              on every transaction.
            </p>

            {/* Search bar */}
            <form
              onSubmit={handleSearch}
              className="mt-9 flex max-w-2xl gap-2 rounded-[22px] border border-primary/10 bg-white p-2.5 shadow-[0_20px_70px_rgba(4,22,3,.12)] dark:border-slate-700 dark:bg-slate-900"
            >
              <label className="flex flex-1 items-center gap-3 rounded-2xl px-3 py-3">
                <Search className="h-5 w-5 shrink-0 text-brandGreen" />
                <span className="sr-only">Search freelance projects or skills</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search skills or project type…"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </label>
              <button
                type="submit"
                className="shrink-0 rounded-[14px] bg-primary px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Search
              </button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/post-job?type=freelance"
                className="inline-flex items-center gap-2 rounded-full bg-brandGreen px-5 py-2.5 text-sm font-bold text-primary transition-opacity hover:opacity-90"
              >
                Post a project <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register?role=freelancer"
                className="inline-flex items-center gap-2 rounded-full border border-primary/15 px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:border-brandGreen hover:text-brandGreen dark:border-slate-700 dark:text-white dark:hover:border-brandGreen dark:hover:text-brandGreen"
              >
                <Briefcase className="h-4 w-4" /> Offer your skills
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────────────── */}
      <section className="border-y border-primary/10 bg-white py-10 dark:border-slate-800 dark:bg-slate-900">
        <div className="container-page">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest text-muted dark:text-slate-500">
            Browse by category
          </p>
          <div className="flex flex-wrap gap-2.5">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/feed?type=freelance&category=${encodeURIComponent(cat)}`}
                className="rounded-full border border-primary/10 bg-primary/5 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-brandGreen hover:bg-brandGreen/10 hover:text-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brandGreen dark:hover:bg-brandGreen/10 dark:hover:text-brandGreen"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="bg-[#fffdf8] py-20 dark:bg-slate-950">
        <div className="container-page">
          <h2 className="mb-3 text-3xl font-black tracking-tight text-primary dark:text-white md:text-4xl">
            Why Beleqet Freelance?
          </h2>
          <p className="mb-12 max-w-xl text-base text-muted dark:text-slate-400">
            The tools and trust layer Ethiopian freelancers and clients have been waiting for.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-primary/10 bg-white p-6 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brandGreen/10 text-brandGreen">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mb-2 text-base font-bold text-primary dark:text-white">{title}</h3>
                <p className="text-sm leading-6 text-muted dark:text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-primary py-20 dark:bg-slate-900">
        <div className="container-page text-center">
          <h2 className="mb-4 text-3xl font-black tracking-tight text-white md:text-4xl">
            Ready to get started?
          </h2>
          <p className="mb-8 text-base text-white/70">
            Join thousands of Ethiopian freelancers and clients building the future of work.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/register?role=freelancer"
              className="rounded-full bg-brandGreen px-8 py-3.5 text-sm font-bold text-primary transition-opacity hover:opacity-90"
            >
              Join as a freelancer
            </Link>
            <Link
              href="/post-job?type=freelance"
              className="rounded-full border border-white/20 px-8 py-3.5 text-sm font-bold text-white transition-colors hover:border-brandGreen hover:text-brandGreen"
            >
              Post a project
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
