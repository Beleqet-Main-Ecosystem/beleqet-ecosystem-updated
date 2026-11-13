'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import { searchJobs, type Job } from '@/lib/api';
import { apiGet, fetchProfile, type Profile } from '@/features/dashboard/api';
import { formatSalary, postedAgo } from '@/features/jobs/format';
import { botRegistrationUrl, openInTelegram } from '@/lib/telegram-login';
import { Band, CompanyMark, TabBar, card, chipOff, chipOn, muted } from '@/features/miniapp/ui';

type Filter = { id: string; label: string; params: { q?: string; location?: string; type?: string } };

const PAGE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Mini App's home for job seekers: jobs for them first, then a search and quick filters. */
export default function MiniAppFeed() {
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filterId, setFilterId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [failed, setFailed] = useState(false);

  // Employers have their own home in the Mini App.
  useEffect(() => {
    if (ready && user?.role === 'EMPLOYER') router.replace('/tg/employer');
  }, [ready, user, router]);

  useEffect(() => {
    if (!user) return;
    fetchProfile().then(setProfile).catch(() => setProfile(null));
    apiGet<Array<{ jobId: string }>>('/applications/my')
      .then((rows) => setApplied(new Set((rows ?? []).map((row) => row.jobId))))
      .catch(() => undefined);
  }, [user]);

  // Searching waits until typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const filters = useMemo<Filter[]>(() => {
    const list: Filter[] = [];
    const city = profile?.city || null;
    const title = profile?.headline?.trim() || null;
    if (title || city) list.push({ id: 'foryou', label: t('mini.feed.forYou'), params: { q: title ?? undefined, location: city ?? undefined } });
    list.push({ id: 'all', label: t('mini.feed.all'), params: {} });
    if (city) list.push({ id: 'city', label: city, params: { location: city } });
    for (const type of ['FULL_TIME', 'REMOTE', 'PART_TIME', 'CONTRACT']) {
      list.push({ id: type, label: t(`search.types.${type}`), params: { type } });
    }
    return list;
  }, [profile, t]);
  const filter = filters.find((f) => f.id === filterId) ?? filters[0];

  const load = useCallback(
    (nextPage: number) => {
      setFailed(false);
      const params = { ...filter.params, ...(search ? { q: search } : {}), page: nextPage, limit: PAGE_SIZE };
      searchJobs(params)
        .then((result) => {
          setJobs((current) => (nextPage === 1 || !current ? result.jobs : [...current, ...result.jobs]));
          setPage(result.page);
          setPages(result.totalPages);
        })
        .catch(() => setFailed(true));
    },
    [filter, search],
  );
  useEffect(() => {
    setJobs(null);
    load(1);
  }, [load]);

  const greeting = user ? t('mini.feed.hello').replace('{name}', user.firstName) : t('mini.feed.title');
  const about = [profile?.headline, profile?.city].filter(Boolean).join(' · ');

  return (
    <>
      <Band>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-xl font-bold tracking-[-0.02em]">{greeting}</h1>
            {about && <p className="text-[13px] text-white/70">{about}</p>}
          </div>
          <label className="flex h-[46px] items-center gap-2.5 rounded-xl bg-white px-3.5 text-mini-muted dark:bg-slate-900 dark:text-slate-400">
            <span className="sr-only">{t('mini.feed.search')}</span>
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('mini.feed.search')}
              className="min-w-0 flex-1 bg-transparent text-base text-ink-900 outline-none placeholder:text-mini-muted dark:text-white"
            />
          </label>
        </div>
      </Band>

      <div role="group" aria-label={t('mini.feed.filters')} className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
        {filters.map((f) => (
          <button key={f.id} type="button" aria-pressed={f.id === filter.id} onClick={() => setFilterId(f.id)} className={f.id === filter.id ? chipOn : chipOff}>
            {f.label}
          </button>
        ))}
      </div>

      <main className="flex flex-1 flex-col gap-2.5 px-4 pb-4">
        {ready && !user && (
          <section className={`${card} flex flex-col gap-2 p-4`}>
            <b className="text-[15px] text-mini-ink dark:text-white">{t('mini.guest.title')}</b>
            <p className={muted}>{t('mini.guest.text')}</p>
            <button type="button" onClick={() => openInTelegram(botRegistrationUrl(null))} className="self-start rounded-xl bg-mini-lime px-4 py-2.5 text-sm font-extrabold text-mini-onLime">
              {t('mini.guest.button')}
            </button>
          </section>
        )}

        {failed && (
          <div className={`${card} flex flex-col items-center gap-3 p-6 text-center`}>
            <p className={muted}>{t('mini.feed.failed')}</p>
            <button type="button" onClick={() => load(1)} className="rounded-xl border border-ink-300 px-4 py-2.5 text-sm font-bold dark:border-slate-700">{t('mini.retry')}</button>
          </div>
        )}
        {!failed && jobs === null && <div className="min-h-[50vh]" aria-busy="true" />}
        {jobs?.length === 0 && (
          <div className={`${card} flex flex-col items-center gap-3 p-6 text-center`}>
            <b className="text-[15px]">{t('mini.feed.none')}</b>
            {filter.id !== 'all' && (
              <button type="button" onClick={() => setFilterId('all')} className="rounded-xl border border-ink-300 px-4 py-2.5 text-sm font-bold dark:border-slate-700">{t('mini.feed.seeAll')}</button>
            )}
          </div>
        )}

        {jobs?.map((job) => {
          const isNew = job.createdAt ? Date.now() - new Date(job.createdAt).getTime() < DAY_MS : false;
          const pay = formatSalary(job, t('search.upTo')) ?? t('mini.salaryNotListed');
          const typeLabel = job.typeCode ? t(`search.types.${job.typeCode}`) : job.type;
          return (
            <Link key={job.id} href={`/tg/jobs/${job.id}`} className={`${card} flex gap-3 p-3.5`}>
              <CompanyMark name={job.company} logo={job.companyLogo} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <b className="min-w-0 flex-1 truncate text-[15px] text-ink-900 dark:text-white">{job.title}</b>
                  {applied.has(job.id) ? (
                    <span className="shrink-0 rounded-md bg-mini-lime/20 px-1.5 py-0.5 text-[11px] font-extrabold text-mini-tag dark:text-mini-lime">{t('mini.badge.applied')}</span>
                  ) : isNew ? (
                    <span className="shrink-0 rounded-md bg-mini-lime px-1.5 py-0.5 text-[11px] font-extrabold text-mini-onLime">{t('mini.badge.new')}</span>
                  ) : null}
                </span>
                <span className="text-[13px] text-ink-700 dark:text-slate-300">{job.company}</span>
                <span className={muted}>{[job.location, typeLabel].filter(Boolean).join(' · ')}</span>
                <span className="mt-1 flex items-center justify-between gap-2">
                  <b className="text-sm text-ink-900 dark:text-white">{pay}</b>
                  <span className="shrink-0 text-xs text-mini-muted dark:text-slate-400">{postedAgo(job.createdAt, locale, job.postedAgo)}</span>
                </span>
              </span>
            </Link>
          );
        })}

        {jobs && jobs.length > 0 && page < pages && (
          <button type="button" onClick={() => load(page + 1)} className="min-h-12 rounded-xl border border-ink-300 bg-white text-[15px] font-bold dark:border-slate-700 dark:bg-slate-900">
            {t('mini.feed.more')}
          </button>
        )}
      </main>

      {user && <TabBar />}
    </>
  );
}
