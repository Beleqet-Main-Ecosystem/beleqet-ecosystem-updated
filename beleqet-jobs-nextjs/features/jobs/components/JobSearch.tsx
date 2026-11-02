'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, MapPin, Search, SearchX, Send, SlidersHorizontal, X } from 'lucide-react';
import type { Category, JobSearchResult } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { categoryLabel, featuredCategories } from '../categories';
import { JOB_TYPES, QUICK_LOCATIONS, hasFilters, jobSearchHref, pageWindow, toggleType, type JobSearch as SearchState } from '../search-params';
import JobResultCard from './JobResultCard';

const TELEGRAM_CHANNEL = 'https://t.me/BeleqetJobs';
const wrap = 'mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10';
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2';

/** City shortcuts search in English (as listings are written) but display translated. */
function placeLabel(place: string, t: (key: string) => string): string {
  const key = `search.places.${place}`;
  const label = t(key);
  return label === key ? place : label;
}

type Props = {
  search: SearchState;
  /** null when the API could not be reached. */
  result: JobSearchResult | null;
  categories: Category[];
};

export default function JobSearch({ search, result, categories }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Filters re-run the server search; the old results dim until the new ones arrive.
  const go = (changes: Partial<SearchState>) =>
    startTransition(() => router.push(jobSearchHref(search, { page: 1, ...changes }), { scroll: false }));

  const activeCategory = categories.find((c) => c.id === search.category);
  const chips = [
    ...search.types.map((code) => ({ key: `type-${code}`, label: t(`search.types.${code}`), clear: { types: search.types.filter((item) => item !== code) } })),
    activeCategory && { key: 'category', label: categoryLabel(activeCategory, t), clear: { category: '' } },
    search.loc && { key: 'loc', label: placeLabel(search.loc, t), clear: { loc: '' } },
    // The company name comes from the results; every result is from that one employer.
    search.company && { key: 'company', label: t('search.fromEmployer').replace('{company}', result?.jobs[0]?.company ?? t('search.oneEmployer')), clear: { company: '' } },
  ].filter(Boolean) as { key: string; label: string; clear: Partial<SearchState> }[];
  const clearAll = () => go({ types: [], category: '', loc: '', company: '' });

  const total = result?.total ?? 0;
  // No count when the API couldn't be reached: '0 jobs' would be a false statement.
  const countText = result ? `${total.toLocaleString('en-US')} ${t(total === 1 ? 'search.job' : 'search.jobs')}` : '';
  const context = [search.q && `“${search.q}”`, search.loc && placeLabel(search.loc, t)].filter(Boolean);

  return (
    <>
      <SearchBand search={search} onSearch={(q, loc) => go({ q, loc })} />

      {/* Mobile: sticky bar with the filter sheet trigger and the count. */}
      <div className="sticky top-[72px] z-30 flex items-center gap-2.5 border-b border-ink-200 bg-canvas px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-950">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-ink-300 bg-surface px-3.5 text-sm font-bold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t('search.filters')}
          {chips.length > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs text-limeAccent">{chips.length}</span>
          )}
        </button>
        <span className="text-sm text-ink-700 dark:text-slate-300">
          <b className="text-ink-900 dark:text-white">{countText}</b>
        </span>
      </div>

      <div className={`${wrap} flex items-start gap-7 pb-16 pt-5 md:pt-7`}>
        <aside
          aria-label={t('search.filters')}
          className="hidden w-[280px] shrink-0 rounded-xl border border-ink-200 bg-surface px-5 pb-5 pt-2 md:block dark:border-slate-800 dark:bg-slate-900"
        >
          <FilterPanel search={search} categories={categories} onChange={go} onClear={clearAll} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-3.5" aria-busy={pending}>
          <div className="hidden flex-wrap items-center justify-between gap-2.5 md:flex">
            <p role="status" className="text-[15px] text-ink-700 dark:text-slate-300">
              <b className="text-ink-900 dark:text-white">{countText}</b>
              {context.length > 0 && ` ${t('search.for')} ${context.join(` ${t('search.in')} `)}`}
            </p>
            <span className="text-[13px] text-ink-600 dark:text-slate-400">{t('search.order')}</span>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => go(chip.clear)}
                  aria-label={`${t('search.removeFilter')} ${chip.label}`}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border border-ink-300 bg-surface px-3 text-[13px] font-semibold text-ink-900 hover:border-ink-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`}
                >
                  {chip.label}
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          <div className={`flex flex-col gap-3.5 transition-opacity ${pending ? 'pointer-events-none opacity-50' : ''}`}>
            {result === null ? (
              <StatePanel
                icon={<SearchX className="h-[26px] w-[26px]" aria-hidden="true" />}
                title={t('search.errorTitle')}
                text={t('search.errorText')}
                actions={
                  <button
                    type="button"
                    onClick={() => startTransition(() => router.refresh())}
                    className={`min-h-12 rounded-md bg-primary px-[18px] text-[15px] font-bold text-white ${focusRing}`}
                  >
                    {t('search.retry')}
                  </button>
                }
              />
            ) : result.jobs.length === 0 && search.page > 1 ? (
              <StatePanel
                icon={<SearchX className="h-[26px] w-[26px]" aria-hidden="true" />}
                title={t('search.pastEndTitle')}
                text={t('search.pastEndText')}
                actions={
                  <Link href={jobSearchHref(search, { page: 1 })} className={`inline-flex min-h-12 items-center rounded-md bg-primary px-[18px] text-[15px] font-bold text-white ${focusRing}`}>
                    {t('search.firstPage')}
                  </Link>
                }
              />
            ) : result.jobs.length === 0 ? (
              <StatePanel
                icon={<SearchX className="h-[26px] w-[26px]" aria-hidden="true" />}
                title={t('search.emptyTitle')}
                text={t('search.emptyText')}
                actions={
                  <>
                    {(hasFilters(search) || search.q) && (
                      <button
                        type="button"
                        onClick={() => go({ q: '', types: [], category: '', loc: '', company: '' })}
                        className={`min-h-12 rounded-md border border-ink-300 bg-surface px-[18px] text-[15px] font-bold text-ink-900 ${focusRing}`}
                      >
                        {t('search.clearSearch')}
                      </button>
                    )}
                    <a
                      href={TELEGRAM_CHANNEL}
                      rel="noopener noreferrer"
                      target="_blank"
                      className={`inline-flex min-h-12 items-center rounded-md bg-primary px-[18px] text-[15px] font-bold text-white ${focusRing}`}
                    >
                      {t('search.alertsCta')}
                    </a>
                  </>
                }
              />
            ) : (
              <>
                <ul className="flex flex-col gap-3">
                  {result.jobs.map((job) => (
                    <JobResultCard key={job.id} job={job} />
                  ))}
                </ul>
                <AlertsBanner />
                <Pagination search={search} page={result.page} totalPages={result.totalPages} />
              </>
            )}
          </div>
        </main>
      </div>

      {sheetOpen && (
        <FilterSheet onClose={() => setSheetOpen(false)} countText={countText}>
          <FilterPanel search={search} categories={categories} onChange={go} onClear={clearAll} inSheet />
        </FilterSheet>
      )}
    </>
  );
}

/* ─────────────────────────────── Search band ─────────────────────────────── */

function SearchBand({ search, onSearch }: { search: SearchState; onSearch: (q: string, loc: string) => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState(search.q);
  const [loc, setLoc] = useState(search.loc);
  // Keep the boxes in step when the URL changes (chips, back button).
  useEffect(() => setQ(search.q), [search.q]);
  useEffect(() => setLoc(search.loc), [search.loc]);

  return (
    <section className="bg-primary text-white">
      <div className={`${wrap} flex flex-col gap-3 pb-5 pt-2 md:gap-4 md:pb-8 md:pt-5`}>
        <nav aria-label={t('search.breadcrumb')} className="hidden text-[13px] text-white/60 md:block">
          <Link href="/" className="text-white/75 hover:text-white">{t('nav.home')}</Link> / <span aria-current="page">{t('nav.findJobs')}</span>
        </nav>
        <h1 className="text-2xl font-extrabold tracking-[-0.03em] md:text-[clamp(28px,3vw,36px)]">{t('search.title')}</h1>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(q.trim(), loc.trim());
          }}
          className="flex flex-col rounded-xl bg-surface p-1 md:flex-row md:flex-wrap md:gap-2 md:p-2"
        >
          <label className="flex min-h-12 items-center gap-2.5 rounded-md px-3 text-ink-600 focus-within:bg-ink-50 md:min-h-[50px] md:flex-[1_1_280px]">
            <span className="sr-only">{t('landing.hero.jobs.kwLabel')}</span>
            <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('landing.hero.jobs.kwPlaceholder')}
              className="w-full min-w-0 bg-transparent text-base text-ink-900 placeholder:text-ink-500 focus:outline-none md:text-[15px]"
              autoComplete="off"
            />
          </label>
          <label className="flex min-h-12 items-center gap-2.5 border-t border-ink-200 px-3 text-ink-600 focus-within:bg-ink-50 md:min-h-[50px] md:flex-[1_1_200px] md:border-l md:border-t-0">
            <span className="sr-only">{t('landing.hero.jobs.locLabel')}</span>
            <MapPin className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              placeholder={t('landing.hero.jobs.locPlaceholder')}
              className="w-full min-w-0 bg-transparent text-base text-ink-900 placeholder:text-ink-500 focus:outline-none md:text-[15px]"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className="min-h-12 rounded-md bg-limeAccent px-[26px] text-base font-extrabold text-obsidian hover:bg-[#c8ef2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:min-h-[50px] md:text-[15px]"
          >
            {t('search.submit')}
          </button>
        </form>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Filters ─────────────────────────────── */

function FilterPanel({
  search,
  categories,
  onChange,
  onClear,
  inSheet = false,
}: {
  search: SearchState;
  categories: Category[];
  onChange: (changes: Partial<SearchState>) => void;
  onClear: () => void;
  /** In the mobile sheet, whose header already says Filters. */
  inSheet?: boolean;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const idPrefix = inSheet ? 'sheet-' : '';
  const featured = featuredCategories(categories);
  // The selected category stays visible even when it isn't a featured one.
  const extra = categories.find((c) => c.id === search.category && !featured.includes(c));
  const listed = showAll ? categories : extra ? [...featured, extra] : featured;

  const legend = 'pb-2 pt-0 text-[13px] font-bold uppercase tracking-[0.04em] text-ink-600 dark:text-slate-400';
  const rowButton = (on: boolean) =>
    `block min-h-10 w-full rounded-md px-2.5 text-left text-[15px] ${focusRing} ${
      on ? 'bg-[#EEF5EF] font-bold text-forest dark:bg-forest/20 dark:text-limeAccent' : 'font-medium text-ink-900 hover:bg-ink-50 dark:text-slate-200 dark:hover:bg-slate-800'
    }`;
  const pill = (on: boolean) =>
    `min-h-9 rounded-full border px-3 text-[13px] ${focusRing} ${
      on
        ? 'border-primary bg-primary font-bold text-white dark:border-limeAccent dark:bg-limeAccent dark:text-obsidian'
        : 'border-ink-300 bg-surface font-semibold text-ink-900 hover:border-ink-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
    }`;

  return (
    <div className="flex flex-col">
      <div className={`flex items-center justify-between py-3 ${inSheet && !hasFilters(search) ? 'hidden' : ''}`}>
        <h2 className={inSheet ? 'sr-only' : 'text-base font-bold text-ink-900 dark:text-white'}>{t('search.filters')}</h2>
        {hasFilters(search) && (
          <button type="button" onClick={onClear} className={`min-h-9 rounded px-1 text-sm font-semibold text-forest dark:text-limeAccent ${focusRing}`}>
            {t('search.clearAll')}
          </button>
        )}
      </div>

      <div role="group" aria-labelledby={`${idPrefix}filter-type`} className="flex flex-col gap-1 border-t border-ink-200 py-3.5 dark:border-slate-800">
        <h3 id={`${idPrefix}filter-type`} className={legend}>{t('search.jobType')}</h3>
        <div className="flex flex-wrap gap-1.5">
          {JOB_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={search.types.includes(type)}
              onClick={() => onChange({ types: toggleType(search.types, type) })}
              className={pill(search.types.includes(type))}
            >
              {t(`search.types.${type}`)}
            </button>
          ))}
        </div>
      </div>

      <div role="group" aria-labelledby={`${idPrefix}filter-category`} className="flex flex-col gap-0.5 border-t border-ink-200 py-3.5 dark:border-slate-800">
        <h3 id={`${idPrefix}filter-category`} className={legend}>{t('search.category')}</h3>
        <button type="button" aria-pressed={!search.category} onClick={() => onChange({ category: '' })} className={rowButton(!search.category)}>
          {t('search.allCategories')}
        </button>
        {listed.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={search.category === c.id}
            onClick={() => onChange({ category: c.id })}
            className={rowButton(search.category === c.id)}
          >
            {categoryLabel(c, t)}
          </button>
        ))}
        {categories.length > listed.length && (
          <button type="button" onClick={() => setShowAll(true)} className={`mt-1 min-h-10 rounded px-2.5 text-left text-sm font-bold text-forest dark:text-limeAccent ${focusRing}`}>
            {t('search.moreCategories').replace('{count}', String(categories.length))}
          </button>
        )}
      </div>

      <div role="group" aria-labelledby={`${idPrefix}filter-location`} className="flex flex-col gap-2 border-t border-ink-200 pt-3.5 dark:border-slate-800">
        <h3 id={`${idPrefix}filter-location`} className={legend}>{t('search.location')}</h3>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={search.types.includes('REMOTE')} onClick={() => onChange({ types: toggleType(search.types, 'REMOTE') })} className={pill(search.types.includes('REMOTE'))}>
            {t('search.types.REMOTE')}
          </button>
          {QUICK_LOCATIONS.map((place) => {
            const on = search.loc.toLowerCase() === place.toLowerCase();
            return (
              <button key={place} type="button" aria-pressed={on} onClick={() => onChange({ loc: on ? '' : place })} className={pill(on)}>
                {placeLabel(place, t)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterSheet({ onClose, countText, children }: { onClose: () => void; countText: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-sheet-h"
        className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-[20px] bg-surface shadow-[0_-10px_40px_rgba(0,0,0,0.2)] dark:bg-slate-900"
      >
        <div className="flex items-center justify-between px-4 pt-2">
          <h2 id="filter-sheet-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('search.filters')}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t('search.closeFilters')} className={`grid h-11 w-11 place-items-center rounded-md text-ink-900 dark:text-white ${focusRing}`}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
        <div className="border-t border-ink-200 p-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className={`min-h-12 w-full rounded-md bg-primary text-base font-bold text-white ${focusRing}`}>
            {countText ? t('search.showResults').replace('{count}', countText) : t('search.done')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── States, alerts, pagination ─────────────────────────────── */

function StatePanel({ icon, title, text, actions }: { icon: React.ReactNode; title: string; text: string; actions: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-ink-200 bg-surface px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
      <span className="grid h-14 w-14 place-items-center rounded-[14px] bg-[#EEF5EF] text-forest dark:bg-forest/20 dark:text-limeAccent">{icon}</span>
      <h2 className="text-lg font-bold text-ink-900 md:text-xl dark:text-white">{title}</h2>
      <p className="max-w-[440px] text-[15px] leading-relaxed text-ink-600 dark:text-slate-400">{text}</p>
      <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">{actions}</div>
    </div>
  );
}

function AlertsBanner() {
  const { t } = useTranslation();
  return (
    <aside aria-label={t('search.alertsLabel')} className="flex flex-col gap-3 rounded-xl bg-primary p-[18px] text-white md:flex-row md:flex-wrap md:items-center md:gap-4 md:px-[22px] md:py-5">
      <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-limeAccent text-obsidian md:grid">
        <Send className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex flex-1 flex-col gap-1 md:basis-[260px]">
        <b className="text-base">{t('search.alertsTitle')}</b>
        <span className="text-sm text-white/75">{t('search.alertsText')}</span>
      </span>
      <a
        href={TELEGRAM_CHANNEL}
        rel="noopener noreferrer"
        target="_blank"
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-limeAccent px-[18px] text-sm font-bold text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limeAccent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
      >
        {t('search.alertsButton')}
      </a>
    </aside>
  );
}

function Pagination({ search, page, totalPages }: { search: SearchState; page: number; totalPages: number }) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;
  const cell = `grid h-11 min-w-11 place-items-center rounded-md px-2 text-sm ${focusRing}`;
  const idle = `${cell} border border-ink-200 bg-surface font-semibold text-ink-900 hover:border-ink-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white`;
  return (
    <nav aria-label={t('search.pagination')} className="flex flex-wrap items-center justify-center gap-1.5 pt-2.5">
      {page > 1 ? (
        <Link href={jobSearchHref(search, { page: page - 1 })} aria-label={t('search.previous')} className={idle}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={`${cell} border border-ink-200 text-ink-400 dark:border-slate-800`} aria-hidden="true">
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}
      {pageWindow(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-ink-500" aria-hidden="true">…</span>
        ) : p === page ? (
          <span key={p} aria-current="page" className={`${cell} bg-primary font-bold text-white dark:bg-limeAccent dark:text-obsidian`}>
            {p}
          </span>
        ) : (
          <Link key={p} href={jobSearchHref(search, { page: p })} className={idle}>
            {p}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={jobSearchHref(search, { page: page + 1 })} aria-label={t('search.next')} className={idle}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={`${cell} border border-ink-200 text-ink-400 dark:border-slate-800`} aria-hidden="true">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
