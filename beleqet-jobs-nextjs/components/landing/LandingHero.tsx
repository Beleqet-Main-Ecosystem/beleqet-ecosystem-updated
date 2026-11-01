'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, Search, ShieldCheck } from 'lucide-react';
import { buildSearchUrl, type Gig, type Job } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatBudget, formatSalary, initials } from './format';

type Mode = 'jobs' | 'freelance';

const POPULAR: Record<Mode, string[]> = {
  jobs: ['Accountant', 'Software developer', 'Sales', 'Nurse'],
  freelance: ['Logo design', 'Web development', 'Translation', 'Bookkeeping'],
};

export default function LandingHero({ jobs, gigs }: { jobs: Job[]; gigs: Gig[] }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('jobs');
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('');
  const k = (key: string) => t(`landing.hero.${mode}.${key}`);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    window.location.assign(buildSearchUrl(q, mode === 'jobs' ? loc : '', mode));
  }

  const preview =
    mode === 'jobs'
      ? jobs.slice(0, 4).map((j) => ({
          href: `/jobs/${j.id}`,
          mark: initials(j.company),
          title: j.title,
          meta: [j.company, j.location].filter(Boolean).join(' · '),
          pay: formatSalary(j) ?? t('landing.salaryNotListed'),
          tag: j.type,
        }))
      : gigs.slice(0, 4).map((g) => ({
          href: `/freelance/${g.id}`,
          mark: initials(g.categoryLabel || g.title),
          title: g.title,
          meta: [g.categoryLabel, `${g.bidCount} ${t(g.bidCount === 1 ? 'landing.bid' : 'landing.bids')}`].filter(Boolean).join(' · '),
          pay: formatBudget(g),
          tag: t(g.pricingType === 'HOURLY' ? 'landing.escrowHourly' : 'landing.escrowFixed'),
        }));

  const tab = (id: Mode) =>
    `min-h-11 rounded-md px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandGreen ${
      mode === id ? 'bg-primary text-limeAccent' : 'text-ink-700 hover:bg-white'
    }`;

  return (
    <section className="bg-primary text-white">
      <div className="bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:56px_56px] bg-top">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-[18px] px-4 pt-8 text-center sm:px-6 sm:pt-12 lg:px-10 lg:pt-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-limeAccent/35 px-3 py-1.5 text-[13px] font-semibold text-limeAccent">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('landing.hero.badge')}
          </span>

          <h1 className="max-w-[920px] text-balance text-[clamp(34px,4.6vw,60px)] font-extrabold leading-[1.05] tracking-[-0.035em]">
            {k('lead')}
            <span className="text-limeAccent">{k('accent')}</span>
            {k('tail')}
          </h1>
          <p className="max-w-[640px] text-base leading-relaxed text-white/75 sm:text-lg">{k('sub')}</p>

          <div className="mt-2.5 w-full max-w-[900px] rounded-2xl bg-white p-2 text-left shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
            <div role="group" aria-label={t('landing.hero.modeLabel')} className="m-1 mb-2 inline-flex rounded-[10px] bg-ink-100 p-1">
              <button type="button" aria-pressed={mode === 'jobs'} onClick={() => setMode('jobs')} className={tab('jobs')}>
                {t('landing.hero.tabJobs')}
              </button>
              <button type="button" aria-pressed={mode === 'freelance'} onClick={() => setMode('freelance')} className={tab('freelance')}>
                {t('landing.hero.tabFreelance')}
              </button>
            </div>
            <form role="search" onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <label className="flex min-h-[52px] flex-[1_1_260px] items-center gap-2.5 rounded-md px-3 text-ink-600 focus-within:bg-ink-50">
                <span className="sr-only">{k('kwLabel')}</span>
                <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={k('kwPlaceholder')}
                  className="w-full min-w-0 bg-transparent text-base text-ink placeholder:text-ink-500 focus:outline-none"
                  autoComplete="off"
                />
              </label>
              {mode === 'jobs' && (
                <label className="flex min-h-[52px] flex-[1_1_200px] items-center gap-2.5 rounded-md border-ink-200 px-3 text-ink-600 focus-within:bg-ink-50 sm:border-l">
                  <span className="sr-only">{k('locLabel')}</span>
                  <MapPin className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <input
                    type="text"
                    value={loc}
                    onChange={(e) => setLoc(e.target.value)}
                    placeholder={k('locPlaceholder')}
                    className="w-full min-w-0 bg-transparent text-base text-ink placeholder:text-ink-500 focus:outline-none"
                    autoComplete="off"
                  />
                </label>
              )}
              <button
                type="submit"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-md bg-limeAccent px-6 text-[15px] font-extrabold text-primary transition-colors hover:bg-[#c8ef2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {k('searchBtn')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] text-white/65">
            <span>{t('landing.hero.popular')}</span>
            {POPULAR[mode].map((term) => (
              <Link
                key={term}
                href={buildSearchUrl(term, '', mode)}
                className="inline-flex min-h-8 items-center rounded-full border border-white/15 px-3 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limeAccent"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-[1200px] px-4 pb-14 pt-11 sm:px-6 lg:px-10" aria-label={k('previewTitle')}>
          <div className="mb-3.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-white/85">
              <span className="h-2 w-2 rounded-full bg-limeAccent" aria-hidden="true" />
              {k('previewTitle')}
            </span>
            <Link href={mode === 'jobs' ? '/jobs' : '/freelance'} className="text-[13px] font-semibold text-limeAccent hover:underline">
              {t('landing.viewAll')} →
            </Link>
          </div>
          {preview.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
              {preview.map((row) => (
                <Link
                  key={row.href}
                  href={row.href}
                  className="flex flex-col gap-3.5 rounded-xl border border-white/[0.08] bg-primary2 p-4 text-left transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limeAccent"
                >
                  <span className="flex items-center gap-3">
                    <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-md bg-[#123626] text-xs font-bold text-limeAccent" aria-hidden="true">
                      {row.mark}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <b className="truncate text-sm font-semibold">{row.title}</b>
                      <span className="truncate text-xs text-white/60">{row.meta}</span>
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <b className="text-sm font-bold">{row.pay}</b>
                    <span className="shrink-0 text-xs text-white/60">{row.tag}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-white/70">{k('previewEmpty')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
