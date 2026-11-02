'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Search, SearchX, ShieldCheck, TriangleAlert } from 'lucide-react';
import { searchGigs, type Gig, type GigSearchResult } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { GIG_CATEGORIES, GIG_PAGE_SIZE, gigSearchHref, type GigSearch } from '../search-params';
import GigCard from './GigCard';

const POST_HREF = '/post-job?type=freelance';
const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest';
const onDarkRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-limeAccent';
const ESCROW_STEPS = ['post', 'fund', 'approve', 'paid'] as const;

type Sort = 'default' | 'high' | 'low';
type Props = { search: GigSearch; result: GigSearchResult | null };

export default function GigSearchPage({ search, result }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [query, setQuery] = useState(search.q);
  const [sort, setSort] = useState<Sort>('default');
  const [more, setMore] = useState<Gig[]>([]);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);

  // The API has no sort option, so budget sorting covers the projects loaded so far.
  const loaded = useMemo(() => {
    const gigs = [...(result?.gigs ?? []), ...more];
    if (sort === 'default') return gigs;
    const top = (gig: Gig) => gig.budgetMax || gig.budgetMin;
    return gigs.sort((a, b) => (sort === 'high' ? top(b) - top(a) : top(a) - top(b)));
  }, [result, more, sort]);

  const total = result?.total ?? 0;
  const filtered = Boolean(search.q || search.category);

  async function loadMore() {
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const next = await searchGigs({
        q: search.q || undefined,
        category: search.category || undefined,
        page: page + 1,
        limit: GIG_PAGE_SIZE,
      });
      setMore((gigs) => [...gigs, ...next.gigs]);
      setPage(next.page);
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const chip = (label: string, category: string) => {
    const active = search.category === category;
    return (
      <Link
        key={category || 'all'}
        href={gigSearchHref(search, { category })}
        prefetch={false}
        aria-current={active ? 'true' : undefined}
        className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 text-sm ${focusRing} ${
          active
            ? 'border-obsidian bg-obsidian font-bold text-white dark:border-limeAccent dark:bg-limeAccent dark:text-obsidian'
            : 'border-ink-300 bg-surface font-semibold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <section className="bg-obsidian text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-end gap-6 px-4 pb-5 pt-1.5 md:px-[clamp(16px,4vw,40px)] md:pb-8 md:pt-5">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-3 md:gap-3.5">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-limeAccent/[0.14] px-2.5 py-1 text-xs font-bold text-limeAccent md:px-3 md:text-[13px]">
              <ShieldCheck className="hidden h-3.5 w-3.5 md:block" aria-hidden="true" />
              <span className="md:hidden">{t('freelance.safeShort')}</span>
              <span className="hidden md:inline">{t('freelance.safe')}</span>
            </span>
            <h1 className="text-[26px] font-extrabold tracking-[-0.03em] md:text-[clamp(28px,3vw,38px)]">{t('freelance.title')}</h1>
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                router.push(gigSearchHref(search, { q: query.trim() }));
              }}
              className="flex max-w-[720px] gap-1.5 rounded-xl bg-surface p-1 md:gap-2 md:p-2"
            >
              <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 px-2.5 text-ink-500 md:gap-2.5 md:px-3">
                <span className="sr-only">{t('freelance.searchLabel')}</span>
                <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('freelance.searchPlaceholder')}
                  className="w-full min-w-0 bg-transparent text-base text-ink-900 outline-none placeholder:text-ink-500 md:text-[15px]"
                />
              </label>
              <button
                type="submit"
                aria-label={t('freelance.search')}
                className={`grid min-h-12 w-12 place-items-center rounded-lg bg-limeAccent text-[15px] font-extrabold text-obsidian md:w-auto md:px-[26px] ${focusRing}`}
              >
                <ArrowRight className="h-[18px] w-[18px] md:hidden" aria-hidden="true" />
                <span className="hidden md:inline">{t('freelance.search')}</span>
              </button>
            </form>
          </div>
          <Link
            href={POST_HREF}
            className={`hidden flex-[0_1_320px] flex-col gap-1.5 rounded-xl border border-white/[0.14] p-5 text-white md:flex ${onDarkRing}`}
          >
            <b className="text-base">{t('freelance.needTitle')}</b>
            <span className="text-sm leading-normal text-white/70">{t('freelance.needText')}</span>
            <span className="mt-1 text-sm font-bold text-limeAccent">{t('freelance.post')} →</span>
          </Link>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 pb-14 md:gap-[18px] md:px-[clamp(16px,4vw,40px)] md:pb-16 md:pt-6">
        <nav
          aria-label={t('freelance.categories')}
          className="flex gap-2 overflow-x-auto border-b border-ink-200 px-4 py-3.5 md:flex-wrap md:overflow-visible md:border-0 md:p-0 dark:border-slate-800"
        >
          {chip(t('freelance.allProjects'), '')}
          {GIG_CATEGORIES.map((slug) => chip(t(`freelance.cats.${slug}`), slug))}
        </nav>

        <div className="flex flex-col gap-3 px-4 md:gap-[18px] md:px-0">
          {result && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="status" className="text-sm text-ink-700 md:text-[15px] dark:text-slate-300">
                <b className="text-ink-900 dark:text-white">
                  {total} {t(total === 1 ? 'freelance.project' : 'freelance.projects')}
                </b>{' '}
                {t('freelance.openForBids')}
              </p>
              <label className="flex items-center gap-2 text-[13px] text-ink-500 dark:text-slate-400">
                {t('freelance.sortBy')}
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as Sort)}
                  className={`min-h-10 rounded-lg border border-ink-300 bg-surface px-2.5 text-[13px] font-semibold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`}
                >
                  <option value="default">{t('freelance.sortDefault')}</option>
                  <option value="high">{t('freelance.sortHigh')}</option>
                  <option value="low">{t('freelance.sortLow')}</option>
                </select>
              </label>
            </div>
          )}

          {!result ? (
            <Panel icon={<TriangleAlert className="h-[26px] w-[26px]" aria-hidden="true" />} title={t('freelance.errorTitle')} text={t('freelance.errorText')}>
              <button
                type="button"
                disabled={refreshing}
                onClick={() => startTransition(() => router.refresh())}
                className={`min-h-12 rounded-md bg-primary px-[18px] text-[15px] font-bold text-white ${focusRing}`}
              >
                {t('freelance.retry')}
              </button>
            </Panel>
          ) : total === 0 ? (
            <Panel
              icon={<SearchX className="h-[26px] w-[26px]" aria-hidden="true" />}
              title={t(filtered ? 'freelance.emptyTitle' : 'freelance.noneTitle')}
              text={t('freelance.emptyText')}
            >
              {filtered && (
                <Link
                  href="/freelance"
                  className={`inline-flex min-h-12 items-center rounded-md border border-ink-300 px-[18px] text-[15px] font-bold text-ink-900 dark:border-slate-700 dark:text-white ${focusRing}`}
                >
                  {t('freelance.clear')}
                </Link>
              )}
              <Link href={POST_HREF} className={`inline-flex min-h-12 items-center rounded-md bg-obsidian px-[18px] text-[15px] font-bold text-white ${focusRing}`}>
                {t('freelance.post')}
              </Link>
            </Panel>
          ) : (
            <ul className="grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(min(100%,360px),1fr))] md:gap-3.5">
              {loaded.map((gig) => (
                <GigCard key={gig.id} gig={gig} />
              ))}
            </ul>
          )}

          {result && loaded.length < total && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className={`min-h-12 rounded-lg border border-ink-300 bg-surface px-[22px] text-[15px] font-bold text-ink-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`}
              >
                {t(loadingMore ? 'freelance.loadingMore' : 'freelance.loadMore')}
              </button>
              {moreFailed && (
                <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                  {t('freelance.moreFailed')}
                </p>
              )}
            </div>
          )}

          <section
            aria-labelledby="escrow-title"
            className="mt-6 flex flex-col gap-4 rounded-xl border border-ink-200 bg-surface p-5 md:p-6 dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 id="escrow-title" className="text-lg font-bold text-ink-900 dark:text-white">
              {t('freelance.escrowTitle')}
            </h2>
            <ol className="grid gap-3 md:grid-cols-4">
              {ESCROW_STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-2.5 text-sm leading-normal text-ink-700 dark:text-slate-300">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-obsidian text-xs font-bold text-limeAccent" aria-hidden="true">
                    {index + 1}
                  </span>
                  {t(`freelance.steps.${step}`)}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[#F1F4F6] pt-4 text-sm font-bold dark:border-slate-800">
              <Link href="/register?role=freelancer" className={`text-forest hover:underline dark:text-limeAccent ${focusRing}`}>
                {t('freelance.join')} →
              </Link>
              <Link href={POST_HREF} className={`text-forest hover:underline dark:text-limeAccent ${focusRing}`}>
                {t('freelance.post')} →
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Panel({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-xl border border-ink-200 bg-surface px-[18px] py-8 text-center md:px-6 md:py-14 dark:border-slate-800 dark:bg-slate-900">
      <span className="text-ink-500 dark:text-slate-400">{icon}</span>
      <h2 className="text-[17px] font-bold text-ink-900 md:text-xl dark:text-white">{title}</h2>
      <p className="max-w-[420px] text-sm leading-relaxed text-ink-500 md:text-[15px] dark:text-slate-300">{text}</p>
      <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">{children}</div>
    </div>
  );
}
