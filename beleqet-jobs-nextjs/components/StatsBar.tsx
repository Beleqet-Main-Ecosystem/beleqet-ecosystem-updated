/**
 * StatsBar — server component that shows live platform metrics.
 *
 * Data is fetched from `GET /jobs/stats` at build time and revalidated every
 * 5 minutes via Next.js ISR (incremental static regeneration).  If the API is
 * unavailable, `fetchPlatformStats` automatically returns static fallback
 * values so the component never breaks.
 */

import { Briefcase, Building2, Users, Smile, type LucideIcon } from 'lucide-react';
import { fetchPlatformStats } from '@/lib/api';

// Revalidate every 5 minutes for ISR (matches the component's export context)
export const revalidate = 300;

const STAT_ITEMS = [
  {
    key: 'activeJobs' as const,
    label: 'Active Jobs',
    icon: 'briefcase',
    format: (n: number) => n.toLocaleString('en-US') + '+',
  },
  {
    key: 'hiringCompanies' as const,
    label: 'Hiring Companies',
    icon: 'building-2',
    format: (n: number) => n.toLocaleString('en-US') + '+',
  },
  {
    key: 'registeredJobSeekers' as const,
    label: 'Registered Job Seekers',
    icon: 'users',
    format: (n: number) => n.toLocaleString('en-US') + '+',
  },
  {
    key: 'satisfactionRate' as const,
    label: 'Satisfaction Rate',
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

export default async function StatsBar() {
  const stats = await fetchPlatformStats();

  return (
    <section className="border-y border-primary/10 bg-[#d8ff3e]">
      <div className="container-page grid grid-cols-2 sm:grid-cols-4">
        {STAT_ITEMS.map(({ key, label, icon, format }) => {
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
                  {label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
