'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, Search } from 'lucide-react';
import { buildSearchUrl, type Gig, type Job, type PlatformStats } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatBudget, formatSalary, initials } from '@/features/jobs/format';

type Mode = 'jobs' | 'freelance';
type Row = { id: string; href: string; title: string; meta: string; pay: string };

const wrap = 'mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10';
const ROWS = 3;

/**
 * The home page hero: Jobs / Freelance switch, search, a board of live listings that turns over every
 * few seconds, and the platform figures. Everything shown comes from the API.
 */
export default function HomeHero({ jobs, gigs, stats }: { jobs: Job[]; gigs: Gig[]; stats: PlatformStats | null }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('jobs');
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('');
  const k = (key: string) => t(`landing.home.${mode}.${key}`);

  const rows: Row[] = useMemo(
    () =>
      mode === 'jobs'
        ? jobs.map((j) => ({
            id: j.id,
            href: `/jobs/${j.id}`,
            title: j.title,
            meta: [j.company, j.location].filter(Boolean).join(' · '),
            pay: formatSalary(j, t('search.upTo')) ?? t('landing.salaryNotListed'),
          }))
        : gigs.map((g) => ({
            id: g.id,
            href: `/freelance/${g.id}`,
            title: g.title,
            meta: g.categoryLabel,
            pay: formatBudget(g),
          })),
    [mode, jobs, gigs, t],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    window.location.assign(buildSearchUrl(q, mode === 'jobs' ? loc : '', mode));
  }

  const tab = (id: Mode) =>
    `min-h-10 rounded-full px-5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ED957] ${
      mode === id ? 'bg-[#7ED957] text-[#123014]' : 'text-white/70 hover:text-white'
    }`;

  return (
    <section className="hero-diamonds relative overflow-hidden bg-primary text-white">
      <div className={`${wrap} relative grid items-center gap-10 pb-12 pt-10 md:pb-16 md:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14`}>
        <div className="min-w-0">
          <div
            role="group"
            aria-label={t('landing.home.modeLabel')}
            className="mb-7 inline-flex gap-1 rounded-full border border-white/[0.14] bg-white/[0.06] p-1"
          >
            {(['jobs', 'freelance'] as const).map((id) => (
              <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={tab(id)}>
                {t(id === 'jobs' ? 'landing.home.tabJobs' : 'landing.home.tabFreelance')}
              </button>
            ))}
          </div>

          <h1 className="mb-5 font-display text-[clamp(34px,4.2vw,54px)] font-bold leading-[1.08] tracking-[-0.025em]">
            {k('titleLead')}
            <span className="text-[#7ED957]">{k('titleAccent')}</span>
            {k('titleTail')}
          </h1>
          <p className="mb-8 max-w-[500px] text-base leading-relaxed text-white/70 md:text-[17px]">{k('sub')}</p>

          <form
            role="search"
            onSubmit={onSubmit}
            className="flex max-w-[580px] flex-col gap-1 rounded-2xl bg-surface p-1.5 shadow-[0_20px_50px_-18px_rgba(0,0,0,0.5)] focus-within:shadow-[0_0_0_4px_rgba(126,217,87,0.3),0_20px_50px_-18px_rgba(0,0,0,0.5)] sm:flex-row sm:rounded-full"
          >
            <label className="flex min-w-0 flex-1 items-center gap-2.5 px-4">
              <Search className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
              <span className="sr-only">{k('kwLabel')}</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={k('kwPlaceholder')}
                className="min-h-12 w-full min-w-0 bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-500"
              />
            </label>
            {mode === 'jobs' && (
              <label className="flex min-w-0 items-center gap-2.5 border-t border-ink-100 px-4 sm:w-[28%] sm:border-l sm:border-t-0">
                <MapPin className="h-4 w-4 shrink-0 text-ink-500" aria-hidden="true" />
                <span className="sr-only">{k('locLabel')}</span>
                <input
                  value={loc}
                  onChange={(e) => setLoc(e.target.value)}
                  placeholder={k('locPlaceholder')}
                  className="min-h-12 w-full min-w-0 bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-500"
                />
              </label>
            )}
            <button
              type="submit"
              className="flex min-h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-obsidian px-6 text-sm font-bold text-white transition-colors hover:bg-primary2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ED957] sm:rounded-full"
            >
              {k('searchBtn')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>

        <Board key={mode} rows={rows} title={k('boardTitle')} empty={k('boardEmpty')} foot={k('boardFoot')} footHref={mode === 'jobs' ? '/jobs' : '/freelance'} />
      </div>

      {stats && (
        <div className="relative border-t border-white/[0.12]">
          <dl
            aria-label={t('landing.home.stats.label')}
            className={`${wrap} grid grid-cols-3 gap-4 py-6 sm:gap-0 sm:divide-x sm:divide-white/[0.12] md:py-7`}
          >
            {(
              [
                [stats.activeJobs, 'activeJobs'],
                [stats.hiringCompanies, 'companies'],
                [stats.registeredJobSeekers, 'seekers'],
              ] as const
            ).map(([value, key]) => (
              <div key={key} className="flex flex-col-reverse justify-end gap-1 sm:px-8 sm:first:pl-0">
                <dt className="text-xs leading-snug text-white/60 sm:text-[13px]">{t(`landing.home.stats.${key}`)}</dt>
                <dd className="font-display text-[clamp(20px,2vw,28px)] font-bold tabular-nums">{(value ?? 0).toLocaleString('en')}+</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}

/** Three live listings; every 6 seconds one row turns over to show another (paused on hover and for reduced motion). */
function Board({ rows, title, empty, foot, footHref }: { rows: Row[]; title: string; empty: string; foot: string; footHref: string }) {
  // Ids, not rows, so the board follows a language switch.
  const [visible, setVisible] = useState(() => rows.slice(0, ROWS).map((r) => r.id));
  const [flipping, setFlipping] = useState<number | null>(null);
  const paused = useRef(false);

  useEffect(() => {
    if (rows.length <= ROWS || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const interval = setInterval(() => {
      if (paused.current) return;
      const slot = Math.floor(Math.random() * ROWS);
      setFlipping(slot);
      timers.push(
        setTimeout(() => {
          setVisible((current) => {
            const hidden = rows.filter((r) => !current.includes(r.id));
            if (hidden.length === 0) return current;
            const next = [...current];
            next[slot] = hidden[Math.floor(Math.random() * hidden.length)].id;
            return next;
          });
        }, 300),
        setTimeout(() => setFlipping(null), 650),
      );
    }, 6000);
    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [rows]);

  const shown = visible.map((id) => rows.find((r) => r.id === id)).filter((r): r is Row => Boolean(r));

  return (
    <div
      className="min-w-0 overflow-hidden rounded-[20px] bg-surface text-ink-900 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.45)]"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <h2 className="border-b border-ink-100 px-6 py-5 font-display text-lg font-bold text-[#073B25]">{title}</h2>
      {shown.length > 0 ? (
        <ul className="flex flex-col divide-y divide-ink-100 px-3 [perspective:600px]">
          {shown.map((row, i) => (
            <li key={i} className={flipping === i ? 'animate-board-flip' : undefined}>
              <Link
                href={row.href}
                prefetch={false}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-xl px-3 py-4 transition-colors hover:bg-[#F5F8F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
              >
                <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-primary font-display text-xs font-bold text-white" aria-hidden="true">
                  {initials(row.title)}
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-sm font-semibold">{row.title}</b>
                  <span className="block truncate text-[13px] text-ink-600">{row.meta}</span>
                </span>
                <span className="whitespace-nowrap text-right text-[13px] font-bold">{row.pay}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-6 py-10 text-center text-sm text-ink-600">{empty}</p>
      )}
      <div className="border-t border-ink-100 p-3">
        <Link
          href={footHref}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-obsidian text-sm font-bold text-white transition-colors hover:bg-primary2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
        >
          {foot}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
