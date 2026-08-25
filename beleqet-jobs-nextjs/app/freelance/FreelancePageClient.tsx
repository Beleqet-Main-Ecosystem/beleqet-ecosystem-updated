'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  CheckCircle2,
  Clock,
  Lock,
  Search,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Gig {
  id: string;
  title: string;
  categorySlug: string;
  budget: string;
  budgetUnit: string;
  type: 'Fixed' | 'Hourly' | 'Retainer';
  client: string;
  skills: string[];
  posted: string;
  escrow: boolean;
  rating?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_FILTERS = [
  { slug: 'all', label: 'All Gigs' },
  { slug: 'web-app-dev', label: 'Web & App Dev' },
  { slug: 'design-creative', label: 'Design & Creative' },
  { slug: 'writing-translation', label: 'Writing & Translation' },
  { slug: 'marketing-seo', label: 'Marketing & SEO' },
  { slug: 'data-analytics', label: 'Data & Analytics' },
  { slug: 'video-animation', label: 'Video & Animation' },
  { slug: 'finance-accounting', label: 'Finance & Accounting' },
  { slug: 'photography', label: 'Photography' },
];

const FALLBACK_GIGS: Gig[] = [
  {
    id: '1',
    title: 'React Native Mobile App — Fintech MVP',
    categorySlug: 'web-app-dev',
    budget: '12,000–20,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'FinTech Startup',
    skills: ['React Native', 'TypeScript', 'REST API'],
    posted: '2h ago',
    escrow: true,
    rating: 4.9,
  },
  {
    id: '2',
    title: 'Logo & Brand Identity Kit',
    categorySlug: 'design-creative',
    budget: '3,500–6,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'Boutique Roastery',
    skills: ['Illustrator', 'Branding', 'Figma'],
    posted: '5h ago',
    escrow: true,
    rating: 5.0,
  },
  {
    id: '3',
    title: 'Amharic–English Document Translation',
    categorySlug: 'writing-translation',
    budget: '2,000–3,500',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'NGO Ethiopia',
    skills: ['Amharic', 'English', 'Legal Text'],
    posted: '1d ago',
    escrow: true,
    rating: 4.8,
  },
  {
    id: '4',
    title: 'Product Explainer Video (60s)',
    categorySlug: 'video-animation',
    budget: '8,000–14,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'EdTech Company',
    skills: ['After Effects', 'Motion Design'],
    posted: '3h ago',
    escrow: true,
    rating: 4.7,
  },
  {
    id: '5',
    title: 'SEO Audit & Content Strategy (30-day)',
    categorySlug: 'marketing-seo',
    budget: '4,000–7,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'FMCG Brand',
    skills: ['SEO', 'Content Marketing', 'Analytics'],
    posted: '6h ago',
    escrow: true,
    rating: 4.6,
  },
  {
    id: '6',
    title: 'Monthly Bookkeeping & Reporting',
    categorySlug: 'finance-accounting',
    budget: '3,000',
    budgetUnit: 'ETB/mo',
    type: 'Retainer',
    client: 'Small Retailer',
    skills: ['QuickBooks', 'Excel', 'IFRS'],
    posted: '12h ago',
    escrow: true,
    rating: 5.0,
  },
  {
    id: '7',
    title: 'E-commerce Website (Next.js)',
    categorySlug: 'web-app-dev',
    budget: '15,000–25,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'Fashion Store',
    skills: ['Next.js', 'Tailwind CSS', 'Stripe'],
    posted: '2d ago',
    escrow: true,
    rating: 4.9,
  },
  {
    id: '8',
    title: 'Product Photography — 20 SKUs',
    categorySlug: 'photography',
    budget: '5,000–9,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'Cosmetics Brand',
    skills: ['Photography', 'Lightroom', 'Retouching'],
    posted: '1d ago',
    escrow: false,
    rating: 4.5,
  },
  {
    id: '9',
    title: 'Data Dashboard — Power BI',
    categorySlug: 'data-analytics',
    budget: '6,000–10,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'Insurance Co.',
    skills: ['Power BI', 'SQL', 'Excel'],
    posted: '4h ago',
    escrow: true,
    rating: 4.8,
  },
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

// ── Sub-components ────────────────────────────────────────────────────────────

function GigCard({ gig }: { gig: Gig }) {
  const [saved, setSaved] = useState(false);

  const typeBadgeClass = {
    Fixed: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Hourly: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Retainer: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  }[gig.type];

  return (
    <article className="group relative flex flex-col rounded-2xl border border-primary/10 bg-white p-6 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-black text-brandGreen">
          {gig.client
            .split(' ')
            .map((w) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase()}
        </div>
        <button
          onClick={() => setSaved((s) => !s)}
          aria-label={saved ? 'Unsave gig' : 'Save gig'}
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:text-brandGreen dark:text-slate-500 dark:hover:text-brandGreen"
        >
          {saved ? (
            <BookmarkCheck className="h-5 w-5 text-brandGreen" />
          ) : (
            <Bookmark className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Content */}
      <h3 className="mt-4 text-sm font-bold leading-snug text-primary dark:text-white">
        {gig.title}
      </h3>
      <p className="mt-1 text-xs text-muted dark:text-slate-400">{gig.client}</p>

      {/* Skills */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {gig.skills.map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary/70 dark:bg-slate-800 dark:text-slate-400"
          >
            {skill}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-5 flex items-center justify-between gap-2">
        <div>
          <span className="text-base font-black text-primary dark:text-white">{gig.budget}</span>
          <span className="ml-1 text-xs text-muted dark:text-slate-400">{gig.budgetUnit}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${typeBadgeClass}`}>
            {gig.type}
          </span>
          {gig.escrow && (
            <span
              className="flex items-center gap-1 rounded-full bg-brandGreen/10 px-2.5 py-1 text-[11px] font-bold text-brandGreen"
              title="Escrow protected"
            >
              <Shield className="h-3 w-3" />
              Escrow
            </span>
          )}
        </div>
      </div>

      {/* Posted + rating */}
      <div className="mt-3 flex items-center justify-between border-t border-primary/5 pt-3 dark:border-slate-800">
        <div className="flex items-center gap-1 text-[11px] text-muted dark:text-slate-500">
          <Clock className="h-3 w-3" />
          {gig.posted}
        </div>
        {gig.rating && (
          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-500">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {gig.rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Full-card link overlay */}
      <Link
        href={`/feed?type=freelance&gig=${gig.id}`}
        className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brandGreen"
        aria-label={`View gig: ${gig.title}`}
      />
    </article>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FreelancePageClient({ gigs = [] }: { gigs?: Gig[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'budget-high' | 'budget-low'>('recent');

  const allGigs: Gig[] = gigs.length > 0 ? gigs : FALLBACK_GIGS;

  const filtered = allGigs.filter((g) => {
    const matchCat = activeCategory === 'all' || g.categorySlug === activeCategory;
    const q = query.trim().toLowerCase();
    const matchQ =
      !q ||
      g.title.toLowerCase().includes(q) ||
      g.client.toLowerCase().includes(q) ||
      g.skills.some((s) => s.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/feed?type=freelance&q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────── */}
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

            {/* Search */}
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
                  placeholder="Search skills, project type, or client…"
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

      {/* ── BeleqetSafe Escrow Banner ────────────────────────────────── */}
      <section className="border-y border-primary/10 bg-primary dark:border-slate-800">
        <div className="container-page py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brandGreen/20 text-brandGreen">
                <Shield className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-base font-black text-white">BeleqetSafe Escrow</h2>
                <p className="mt-1 text-sm text-white/60">
                  Client funds are held securely until you approve the work. Released instantly via
                  Chapa or Telebirr.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 md:shrink-0">
              {[
                ['1', 'Client posts project'],
                ['2', 'Funds locked in escrow'],
                ['3', 'Work delivered & approved'],
                ['4', 'Payout to your account'],
              ].map(([n, label]) => (
                <div key={n} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brandGreen text-[11px] font-black text-primary">
                    {n}
                  </span>
                  <span className="text-xs font-semibold text-white/70">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex gap-6 border-t border-white/10 pt-5">
            <div className="text-center">
              <p className="text-2xl font-black text-brandGreen">98%</p>
              <p className="text-xs text-white/50">on-time payouts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-brandGreen">0%</p>
              <p className="text-xs text-white/50">payment disputes lost</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-brandGreen">24/7</p>
              <p className="text-xs text-white/50">escrow monitoring</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Gig Feed ─────────────────────────────────────────────────── */}
      <section className="bg-[#f7f5ef] py-14 dark:bg-slate-950">
        <div className="container-page">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-primary dark:text-white">
                Open Freelance Projects
              </h2>
              <p className="mt-1 text-sm text-muted dark:text-slate-400">
                <strong className="text-primary dark:text-white">{filtered.length}</strong> project
                {filtered.length !== 1 ? 's' : ''} available
                {activeCategory !== 'all' && (
                  <>
                    {' '}
                    in{' '}
                    <em>
                      {CATEGORY_FILTERS.find((c) => c.slug === activeCategory)?.label}
                    </em>
                  </>
                )}
              </p>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort gigs"
              className="rounded-xl border border-primary/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-brandGreen dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="recent">Most Recent</option>
              <option value="budget-high">Highest Budget</option>
              <option value="budget-low">Lowest Budget</option>
            </select>
          </div>

          {/* Category tabs */}
          <div
            className="mb-8 flex flex-wrap gap-2"
            role="tablist"
            aria-label="Filter by category"
          >
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.slug}
                role="tab"
                aria-selected={activeCategory === cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activeCategory === cat.slug
                    ? 'bg-primary text-white'
                    : 'border border-primary/10 bg-white text-ink/70 hover:border-primary/20 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          {filtered.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((gig) => (
                <GigCard key={gig.id} gig={gig} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <Search className="h-10 w-10 text-muted/30" />
              <p className="text-sm text-muted dark:text-slate-400">
                No gigs found. Try a different category or search term.
              </p>
              <button
                onClick={() => {
                  setActiveCategory('all');
                  setQuery('');
                }}
                className="rounded-full border border-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Post project CTA */}
          <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-2xl border border-primary/10 bg-white p-7 sm:flex-row sm:items-center dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h3 className="text-base font-bold text-primary dark:text-white">
                Have a project in mind?
              </h3>
              <p className="mt-1 text-sm text-muted dark:text-slate-400">
                Post it free and get proposals from verified Ethiopian freelancers within hours.
              </p>
            </div>
            <Link
              href="/post-job?type=freelance"
              className="shrink-0 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Post a Project Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why Beleqet Freelance ────────────────────────────────────── */}
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

      {/* ── Final CTA ────────────────────────────────────────────────── */}
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
