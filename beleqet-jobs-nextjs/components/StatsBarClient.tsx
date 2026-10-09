'use client';

import { Briefcase, Building2, Users, Smile, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { PlatformStats } from '@/lib/api';

const STAT_ITEMS = [
  {
    key: 'activeJobs' as const,
    labelKey: 'stats.activeJobs',
    icon: 'briefcase',
    format: (n: number) => n.toLocaleString('en-US') + '+',
  },
  {
    key: 'hiringCompanies' as const,
    labelKey: 'stats.hiringCompanies',
    icon: 'building-2',
    format: (n: number) => n.toLocaleString('en-US') + '+',
  },
  {
    key: 'registeredJobSeekers' as const,
    labelKey: 'stats.registeredJobSeekers',
    icon: 'users',
    format: (n: number) => n.toLocaleString('en-US') + '+',
  },
  {
    key: 'satisfactionRate' as const,
    labelKey: 'stats.satisfactionRate',
    icon: 'smile',
    format: (n: number) => n + '%',
  },
] as const;

const iconMap: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  'building-2': Building2,
  users: Users,
  smile: Smile,
};

export default function StatsBarClient({ stats }: { stats: PlatformStats }) {
  const { t } = useTranslation();

  return (
    <div className="container-page grid grid-cols-2 sm:grid-cols-4">
      {STAT_ITEMS.map(({ key, labelKey, icon, format }) => {
        const Icon = iconMap[icon] ?? Briefcase;
        return (
          <div
            key={key}
            className="flex items-center gap-3.5 border-primary/10 px-3 py-7 even:border-l sm:border-l sm:px-6 first:sm:border-l-0"
          >
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-[#d8ff3e] lg:inline-flex">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-black leading-none tracking-tight text-primary">
                {format(stats[key])}
              </p>
              <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-primary/60">
                {t(labelKey)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
