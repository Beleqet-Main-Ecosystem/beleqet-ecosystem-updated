'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  BadgeCheck, CreditCard, Flag, Inbox, Landmark, LayoutGrid, ListChecks, LogOut, Mail, Megaphone, Menu,
  Moon, Repeat, Scale, ScrollText, ShieldAlert, Sun, Users, X, type LucideIcon,
} from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useI18n } from '@/lib/i18n';
import { fullName } from '@/lib/format';

export const NAV: { group: string; items: { id: string; icon: LucideIcon }[] }[] = [
  { group: 'overview', items: [{ id: 'dashboard', icon: LayoutGrid }] },
  { group: 'review', items: [
    { id: 'reports', icon: Flag },
    { id: 'companies', icon: BadgeCheck },
    { id: 'disputes', icon: Scale },
    { id: 'payments', icon: Landmark },
    { id: 'listings', icon: ListChecks },
  ] },
  { group: 'people', items: [
    { id: 'users', icon: Users },
    { id: 'messages', icon: Inbox },
    { id: 'broadcast', icon: Megaphone },
  ] },
  { group: 'billing', items: [
    { id: 'plans', icon: CreditCard },
    { id: 'subscriptions', icon: Repeat },
  ] },
  { group: 'safety', items: [
    { id: 'fraud', icon: ShieldAlert },
    { id: 'audit', icon: ScrollText },
    { id: 'emails', icon: Mail },
  ] },
];

/** Signed-in frame: checks the admin session, then shows navigation around the page. */
export default function Shell({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, user, router, pathname]);

  useEffect(() => setOpen(false), [pathname]);

  if (!ready || !user) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen md:flex">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200 bg-surface px-4 py-2.5 md:hidden dark:border-slate-800 dark:bg-slate-900">
        <Brand />
        <MenuButton open={open} onClick={() => setOpen((value) => !value)} />
      </header>

      {open && <div className="fixed inset-0 z-30 bg-obsidian/60 md:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-ink-200 bg-surface transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 dark:border-slate-800 dark:bg-slate-900 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <Brand />
          <span className="md:hidden"><MenuButton open onClick={() => setOpen(false)} /></span>
        </div>
        <Navigation pathname={pathname} />
        <Footer name={fullName(user)} email={user.email} />
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-16 pt-5 sm:px-6 md:px-8 md:pt-8">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}

function Brand() {
  const { t } = useI18n();
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <Image src="/logo-icon.png" alt="" width={28} height={28} className="rounded-md" />
      <span className="flex flex-col leading-tight">
        <b className="text-[15px] text-ink-900 dark:text-white">Beleqet</b>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest dark:text-limeAccent">{t('shell.admin')}</span>
      </span>
    </Link>
  );
}

function MenuButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { t } = useI18n();
  const Icon = open ? X : Menu;
  return (
    <button type="button" onClick={onClick} aria-label={open ? t('shell.closeMenu') : t('shell.openMenu')} aria-expanded={open} className="grid h-10 w-10 place-items-center rounded-lg text-ink-900 hover:bg-ink-100 dark:text-white dark:hover:bg-slate-800">
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

function Navigation({ pathname }: { pathname: string }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t('shell.nav')} className="flex-1 overflow-y-auto px-3 pb-4">
      {NAV.map(({ group, items }) => (
        <div key={group} className="mb-3">
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-400 dark:text-slate-500">{t(`nav.group.${group}`)}</p>
          <ul className="flex flex-col gap-0.5">
            {items.map(({ id, icon: Icon }) => {
              const active = pathname === `/${id}` || pathname.startsWith(`/${id}/`);
              return (
                <li key={id}>
                  <Link
                    href={`/${id}`}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold ${active ? 'bg-obsidian text-white dark:bg-limeAccent dark:text-obsidian' : 'text-ink-700 hover:bg-ink-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    {t(`nav.${id}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Footer({ name, email }: { name: string; email: string }) {
  const { t, locale, setLocale } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const { signOut } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';
  const iconButton = 'grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-bold text-ink-700 hover:bg-ink-100 dark:text-slate-300 dark:hover:bg-slate-800';

  return (
    <div className="flex flex-col gap-2 border-t border-ink-200 px-4 py-3 dark:border-slate-800">
      <div className="min-w-0">
        <b className="block truncate text-sm text-ink-900 dark:text-white">{name}</b>
        <span className="block truncate text-xs text-ink-500 dark:text-slate-400">{email}</span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" className={iconButton} onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? t('shell.light') : t('shell.dark')}>
          {dark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
        </button>
        <button type="button" className={iconButton} onClick={() => setLocale(locale === 'en' ? 'am' : 'en')} aria-label={t('shell.language')}>
          {locale === 'en' ? 'አማ' : 'EN'}
        </button>
        <button
          type="button"
          className={`${iconButton} ml-auto gap-1.5 !flex`}
          onClick={async () => {
            await signOut();
            router.replace('/login');
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" /> {t('shell.signOut')}
        </button>
      </div>
    </div>
  );
}
