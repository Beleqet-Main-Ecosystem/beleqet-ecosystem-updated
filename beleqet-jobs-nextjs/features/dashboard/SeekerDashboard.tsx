'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, BriefcaseBusiness, CalendarDays, CircleUser, FileCheck2, Handshake, LayoutGrid, MessageSquare, Settings, Wallet as WalletIcon, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';
import Applications from './sections/Applications';
import FreelanceWork from './sections/FreelanceWork';
import Interviews from './sections/Interviews';
import Overview from './sections/Overview';
import ProfileSection from './sections/ProfileSection';
import SavedJobs from './sections/SavedJobs';
import SettingsSection from './sections/SettingsSection';
import Wallet from './sections/Wallet';
import VerifyEmailBanner from './VerifyEmailBanner';

type Item = { id: string; icon: LucideIcon; href?: string };

const BASE: Item[] = [
  { id: 'overview', icon: LayoutGrid },
  { id: 'applications', icon: FileCheck2 },
  { id: 'saved', icon: Bookmark },
  { id: 'profile', icon: CircleUser },
  { id: 'interviews', icon: CalendarDays },
];
const FREELANCE: Item[] = [
  { id: 'bids', icon: BriefcaseBusiness },
  { id: 'contracts', icon: Handshake },
  { id: 'wallet', icon: WalletIcon },
];
const END: Item[] = [
  { id: 'messages', icon: MessageSquare, href: '/messages' },
  { id: 'settings', icon: Settings },
];

export default function SeekerDashboard() {
  const { t } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [seenTab, setSeenTab] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent('/dashboard')}`);
    else if (user.role === 'EMPLOYER') router.replace('/employer');
    else setSeenTab(true);
  }, [ready, user, router]);

  if (!ready || !user || !seenTab) return <div className="min-h-[60vh]" />;

  const freelancer = user.role === 'FREELANCER';
  const nav = [...BASE, ...(freelancer ? FREELANCE : []), ...END];
  const requested = params.get('tab') ?? 'overview';
  const tab = nav.some((item) => item.id === requested && !item.href) ? requested : 'overview';

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pb-14 pt-4 md:flex-row md:gap-8 md:px-[clamp(16px,4vw,40px)] md:pb-16 md:pt-8">
      <nav aria-label={t('dash.nav')} className="-mx-4 shrink-0 overflow-x-auto px-4 md:mx-0 md:w-[220px] md:overflow-visible md:px-0">
        <ul className="flex gap-1.5 md:sticky md:top-[88px] md:flex-col">
          {nav.map(({ id, icon: Icon, href }) => {
            const active = tab === id && !href;
            return (
              <li key={id} className="shrink-0">
                <Link
                  href={href ?? `/dashboard?tab=${id}`}
                  prefetch={false}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold ${active ? 'bg-obsidian text-white dark:bg-limeAccent dark:text-obsidian' : 'text-ink-700 hover:bg-[#EEF1EC] dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  {t(`dash.tabs.${id}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <VerifyEmailBanner />
        {tab === 'overview' && <Overview firstName={user.firstName} />}
        {tab === 'applications' && <Applications />}
        {tab === 'saved' && <SavedJobs />}
        {tab === 'profile' && <ProfileSection />}
        {tab === 'interviews' && <Interviews />}
        {tab === 'bids' && <FreelanceWork kind="bids" />}
        {tab === 'contracts' && <FreelanceWork kind="contracts" />}
        {tab === 'wallet' && <Wallet />}
        {tab === 'settings' && <SettingsSection />}
      </div>
    </div>
  );
}
