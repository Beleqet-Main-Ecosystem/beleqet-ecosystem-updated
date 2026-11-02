'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { ForumThread, PaginatedResponse } from '@/lib/forum-api';
import { useTranslation } from '@/lib/i18n';
import { postedAgo } from '@/features/jobs/format';

export const forumCard = 'rounded-xl border border-ink-200 bg-surface p-4 md:p-5 dark:border-slate-800 dark:bg-slate-900';
export const forumSolid = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-limeAccent px-4 text-sm font-extrabold text-obsidian disabled:opacity-60';
const RULES = ['respect', 'private', 'scams'] as const;
const SORTS = ['latest', 'oldest'] as const;

export type ForumQuery = { search: string; tag: string; sort: string; page: number };

export function forumHref(query: ForumQuery, change: Partial<ForumQuery> = {}): string {
  const next = { ...query, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.search) params.set('search', next.search);
  if (next.tag) params.set('tag', next.tag);
  if (next.sort && next.sort !== 'latest') params.set('sort', next.sort);
  if (next.page > 1) params.set('page', String(next.page));
  const text = params.toString();
  return text ? `/forum?${text}` : '/forum';
}

export default function ForumList({ query, data }: { query: ForumQuery; data: PaginatedResponse<ForumThread> | null }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState(query.search);
  const tags = Array.from(new Set(data?.items.flatMap((thread) => thread.tags) ?? [])).slice(0, 12);
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <>
      <section className="bg-obsidian text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-4 px-4 pb-7 pt-5 md:px-[clamp(16px,4vw,40px)] md:pb-9 md:pt-8">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
            <h1 className="text-[26px] font-extrabold tracking-[-0.03em] md:text-[clamp(28px,3vw,38px)]">{t('forum.title')}</h1>
            <p className="max-w-[640px] text-[15px] leading-relaxed text-white/75">{t('forum.sub')}</p>
          </div>
          <Link href="/forum/new" className={forumSolid}>{t('forum.start')}</Link>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1200px] flex-wrap items-start gap-5 px-4 pb-14 pt-5 md:px-[clamp(16px,4vw,40px)] md:pb-16 md:pt-7">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                router.push(forumHref(query, { search: search.trim() }));
              }}
              className="flex min-h-12 min-w-0 flex-[1_1_260px] items-center gap-2 rounded-lg border border-ink-300 bg-surface px-3 focus-within:ring-2 focus-within:ring-forest dark:border-slate-700 dark:bg-slate-900"
            >
              <Search className="h-[18px] w-[18px] shrink-0 text-ink-500" aria-hidden="true" />
              <input type="search" aria-label={t('forum.search')} placeholder={t('forum.search')} value={search} onChange={(event) => setSearch(event.target.value)} className="w-full min-w-0 bg-transparent text-base text-ink-900 outline-none dark:text-white" />
            </form>
            <span className="flex gap-1.5">
              {SORTS.map((sort) => {
                const on = (query.sort || 'latest') === sort;
                return (
                  <Link
                    key={sort}
                    href={forumHref(query, { sort })}
                    prefetch={false}
                    aria-current={on ? 'true' : undefined}
                    className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm ${on ? 'border-obsidian bg-obsidian font-bold text-white dark:border-limeAccent dark:bg-limeAccent dark:text-obsidian' : 'border-ink-300 bg-surface font-semibold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}`}
                  >
                    {t(`forum.sort.${sort}`)}
                  </Link>
                );
              })}
            </span>
          </div>

          {query.tag && (
            <span className="text-sm text-ink-700 dark:text-slate-300">
              {t('forum.showing')} <b>#{query.tag}</b>{' '}
              <Link href={forumHref(query, { tag: '' })} className="font-bold text-forest hover:underline dark:text-limeAccent">{t('forum.clear')}</Link>
            </span>
          )}

          {!data ? (
            <p role="alert" className={`${forumCard} text-center text-[15px] text-ink-700 dark:text-slate-300`}>{t('forum.failed')}</p>
          ) : data.items.length === 0 ? (
            <p className={`${forumCard} text-center text-[15px] text-ink-700 dark:text-slate-300`}>{t('forum.none')}</p>
          ) : (
            data.items.map((thread) => (
              <article key={thread.id} className={`${forumCard} flex gap-3.5`}>
                <span className="flex w-11 shrink-0 flex-col items-center">
                  <b className="text-lg text-ink-900 dark:text-white">{thread.upvoteCount}</b>
                  <span className="text-[11px] text-ink-500 dark:text-slate-400">{t('forum.votes')}</span>
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  {thread.isPinned && <span className="self-start rounded-md bg-limeAccent px-2 py-0.5 text-[11px] font-extrabold uppercase text-obsidian">{t('forum.pinned')}</span>}
                  <Link href={`/forum/${thread.id}`} prefetch={false} className="font-bold leading-snug text-ink-900 hover:underline dark:text-white">{thread.title}</Link>
                  <p className="line-clamp-2 text-sm leading-normal text-ink-500 dark:text-slate-300">{thread.content}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                    {thread.tags.map((tag) => (
                      <Link key={tag} href={forumHref(query, { tag })} prefetch={false} className="font-semibold text-forest hover:underline dark:text-limeAccent">#{tag}</Link>
                    ))}
                    <span className="text-ink-500 dark:text-slate-400">{thread.isAnonymous ? t('forum.anonymous') : thread.userDisplayName} · {postedAgo(thread.createdAt, locale, '')}</span>
                    <span className="text-ink-500 dark:text-slate-400">{t(thread.replyCount === 1 ? 'forum.reply' : 'forum.replies').replace('{count}', String(thread.replyCount))}</span>
                  </div>
                </div>
              </article>
            ))
          )}

          {totalPages > 1 && (
            <nav aria-label={t('forum.pages')} className="flex flex-wrap justify-center gap-1.5 pt-2">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <Link
                  key={page}
                  href={forumHref(query, { page })}
                  prefetch={false}
                  aria-current={page === query.page ? 'page' : undefined}
                  className={`grid h-11 w-11 place-items-center rounded-lg border text-sm font-bold ${page === query.page ? 'border-obsidian bg-obsidian text-white dark:border-limeAccent dark:bg-limeAccent dark:text-obsidian' : 'border-ink-300 bg-surface text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}`}
                >
                  {page}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <aside className="flex w-full min-w-0 flex-[1_1_280px] flex-col gap-4 md:max-w-[340px]">
          {tags.length > 0 && (
            <section className={`${forumCard} flex flex-col gap-2.5`}>
              <h2 className="text-base font-bold text-ink-900 dark:text-white">{t('forum.tags')}</h2>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Link key={tag} href={forumHref(query, { tag })} prefetch={false} className="rounded-full bg-[#F1F4F6] px-2.5 py-1 text-[13px] font-semibold text-ink-700 dark:bg-slate-800 dark:text-slate-200">#{tag}</Link>
                ))}
              </div>
            </section>
          )}
          <section className={`${forumCard} flex flex-col gap-2`}>
            <h2 className="text-base font-bold text-ink-900 dark:text-white">{t('forum.rules')}</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink-700 dark:text-slate-300">
              {RULES.map((rule) => (
                <li key={rule}>{t(`forum.rule.${rule}`)}</li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
