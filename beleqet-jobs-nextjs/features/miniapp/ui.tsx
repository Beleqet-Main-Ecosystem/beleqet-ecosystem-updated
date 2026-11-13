'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, ClipboardCheck, UserRound } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { initials } from '@/features/jobs/format';

/** Class strings shared by the Mini App screens. */
export const card = 'rounded-2xl border border-ink-200 bg-white dark:border-slate-800 dark:bg-slate-900';
export const muted = 'text-[13px] text-mini-muted dark:text-slate-400';
export const heading = 'font-display text-[22px] font-bold leading-tight tracking-[-0.02em] text-mini-ink dark:text-white';
export const chipOn = 'shrink-0 h-9 rounded-full border border-mini-ink bg-mini-ink px-3.5 text-sm font-bold text-mini-lime dark:border-mini-lime dark:bg-mini-lime dark:text-mini-onLime';
export const chipOff = 'shrink-0 h-9 rounded-full border border-ink-300 bg-white px-3.5 text-sm font-semibold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
export const outlineButton = 'flex min-h-11 items-center justify-center rounded-xl border border-ink-300 bg-white px-4 text-sm font-bold text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white';

/** A company logo, or its initials on the dark green (also when the logo doesn't load). */
export function CompanyMark({ name, logo, size = 44 }: { name: string; logo?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (logo && /^https?:\/\//.test(logo) && !broken) {
    // eslint-disable-next-line @next/next/no-img-element -- company logos come from many hosts
    return <img src={logo} alt="" onError={() => setBroken(true)} style={style} className="shrink-0 rounded-xl border border-ink-200 bg-white object-contain dark:border-slate-700" />;
  }
  return (
    <span aria-hidden="true" style={style} className="grid shrink-0 place-items-center rounded-xl bg-mini-ink text-[13px] font-extrabold text-mini-lime">
      {initials(name)}
    </span>
  );
}

/** The green band at the top of a screen, continuing Telegram's header colour. */
export function Band({ children }: { children: React.ReactNode }) {
  return <section className="bg-mini-deep px-4 pb-5 pt-2 text-white">{children}</section>;
}

const TABS = [
  { href: '/tg', key: 'jobs', Icon: Briefcase },
  { href: '/tg/applications', key: 'applications', Icon: ClipboardCheck },
  { href: '/tg/profile', key: 'profile', Icon: UserRound },
] as const;

/** Job seekers' sections. Hidden on screens whose main action is Telegram's bottom button. */
export function TabBar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  return (
    <nav aria-label={t('mini.tabs.label')} className="sticky bottom-0 z-10 grid grid-cols-3 border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900">
      {TABS.map(({ href, key, Icon }) => {
        const active = href === '/tg' ? pathname === '/tg' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${active ? 'font-extrabold text-mini-tag dark:text-mini-lime' : 'font-semibold text-mini-muted dark:text-slate-400'}`}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 2} aria-hidden="true" />
            {t(`mini.tabs.${key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
