'use client';

import Link from 'next/link';
import { buildSearchUrl } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import SearchBar from './SearchBar';

const POPULAR = ['Developer', 'Marketing', 'Designer', 'Accounting', 'Sales', 'Remote'];

export interface HeroProps {
  stats?: {
    activeJobs?: number;
    hiringCompanies?: number;
  } | null;
}

export default function Hero({ stats = null }: HeroProps) {
  const { t } = useTranslation();
  const showStats = Boolean(stats && (stats.activeJobs ?? 0) > 0);

  return (
    <section className="bg-brand-900 text-white">
      <div className="container-page py-14 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-brand-100 sm:text-lg">
            {t('hero.subtitle')}
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-4xl">
          <SearchBar />

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-brand-200">{t('hero.popular')}</span>
            {POPULAR.map((term) => (
              <Link
                key={term}
                href={buildSearchUrl(term, '', 'jobs')}
                className="rounded-full border border-white/25 px-3 py-1 text-white transition-colors hover:bg-white/10"
              >
                {term}
              </Link>
            ))}
          </div>

          {showStats && stats && (
            <p className="mt-8 text-center text-sm text-brand-200">
              {stats.activeJobs?.toLocaleString()} {t('stats.activeJobs')}
              {Boolean(stats.hiringCompanies && stats.hiringCompanies > 0) && (
                <>
                  {' · '}
                  {stats.hiringCompanies?.toLocaleString()} {t('stats.companies') || t('stats.hiringCompanies')}
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
