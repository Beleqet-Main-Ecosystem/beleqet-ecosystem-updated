'use client';

import Link from 'next/link';
import { Bookmark, Check } from 'lucide-react';
import type { Gig } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatBudget, postedAgo } from '@/features/jobs/format';

const tag = 'rounded-md px-2 py-[3px] text-[11px] font-extrabold uppercase tracking-[0.04em]';

export default function GigCard({ gig, saved, onToggleSave }: { gig: Gig; saved?: boolean; onToggleSave?: () => void }) {
  const { t, locale } = useTranslation();
  const hourly = gig.pricingType === 'HOURLY';
  const bids = `${gig.bidCount} ${t(gig.bidCount === 1 ? 'freelance.bid' : 'freelance.bids')}`;

  return (
    <li
      className={`relative flex flex-col gap-2.5 rounded-xl border bg-surface p-4 transition-shadow hover:shadow-card-hover md:gap-3.5 md:p-[22px] dark:bg-slate-900 ${
        gig.featured ? 'border-[#B9D88A] dark:border-limeAccent/40' : 'border-ink-200 dark:border-slate-800'
      }`}
    >
      <div className="flex flex-wrap gap-1.5">
        {gig.featured && <span className={`${tag} hidden bg-limeAccent text-obsidian md:inline`}>{t('freelance.featured')}</span>}
        {gig.funded && (
          <span className={`${tag} inline-flex items-center gap-1 bg-[#EEF5EF] text-forest dark:bg-forest/30 dark:text-limeAccent`}>
            <Check className="h-3 w-3" aria-hidden="true" />
            {t('freelance.funded')}
          </span>
        )}
        <span className={`${tag} bg-[#F1F4F6] text-ink-700 dark:bg-slate-800 dark:text-slate-200`}>
          {t(hourly ? 'freelance.hourly' : 'freelance.fixed')}
        </span>
        {onToggleSave && (
          // Above the card-wide title link, so it can be clicked on its own.
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            aria-label={t(saved ? 'freelance.unsaveProject' : 'freelance.saveProject').replace('{title}', gig.title)}
            className={`relative z-10 ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-bold ${
              saved
                ? 'border-obsidian bg-obsidian text-limeAccent dark:border-limeAccent dark:bg-limeAccent dark:text-obsidian'
                : 'border-ink-300 bg-surface text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
            {t(saved ? 'freelance.saved' : 'freelance.save')}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {/* The title link covers the whole card. No prefetch: a page of cards would each hit the API. */}
        <Link
          href={`/freelance/${gig.id}`}
          prefetch={false}
          className="text-base font-bold leading-[1.35] tracking-[-0.01em] text-ink-900 after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-forest md:text-lg md:leading-[1.3] dark:text-white"
        >
          {gig.title}
        </Link>
        {gig.clientName && <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('freelance.postedBy').replace('{name}', gig.clientName)}</span>}
        <p className="hidden text-sm leading-[1.55] text-ink-500 line-clamp-2 md:[display:-webkit-box] dark:text-slate-300">{gig.description}</p>
      </div>

      {gig.skills.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {gig.skills.slice(0, 4).map((skill) => (
            <li key={skill} className="rounded-full border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-700 dark:border-slate-700 dark:text-slate-200">
              {skill}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F4F6] pt-2.5 md:pt-3.5 dark:border-slate-800">
        <div className="flex flex-col gap-0.5">
          <b className="text-[15px] text-ink-900 md:text-base dark:text-white">
            {formatBudget(gig)}
            {hourly && ` / ${t('freelance.hour')}`}
          </b>
          {gig.deadlineDays != null && (
            <span className="hidden text-xs text-ink-500 md:block dark:text-slate-400">
              {t('freelance.deliveryIn').replace('{days}', String(gig.deadlineDays))}
            </span>
          )}
        </div>
        <span className="text-[13px] text-ink-500 dark:text-slate-400">
          {bids} · {postedAgo(gig.createdAt, locale, t('freelance.recently'))}
        </span>
      </div>
    </li>
  );
}
