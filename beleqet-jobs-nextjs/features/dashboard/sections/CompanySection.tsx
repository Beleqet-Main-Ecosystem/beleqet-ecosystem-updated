'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { initials, safeHttpUrl } from '@/features/jobs/format';
import { apiGet } from '../api';
import { card, Empty, Failed, Heading, muted, solid } from '../ui';

type Company = {
  name: string;
  industry?: string | null;
  location?: string | null;
  size?: string | null;
  description?: string | null;
  website?: string | null;
  verified?: boolean;
};

/** Read-only for now: the API can create a company profile but not change one. */
export default function CompanySection({ openJobs }: { openJobs: number }) {
  const { t } = useTranslation();
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    apiGet<Company | null>('/users/company').then(setCompany).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return <Failed onRetry={load} />;
  if (company === undefined) return <div className="min-h-[40vh]" />;
  if (company === null) {
    return (
      <Empty title={t('postJob.companyTitle')} text={t('postJob.companyText')}>
        <Link href="/post-job" className={`${solid} mt-2`}>{t('postJob.title')}</Link>
      </Empty>
    );
  }

  const website = safeHttpUrl(company.website);

  return (
    <>
      <Heading title={t('emp.tabs.company')} sub={t('emp.companySub')} />
      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-primary text-lg font-bold text-limeAccent" aria-hidden="true">{initials(company.name)}</span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <b className="text-lg text-ink-900 dark:text-white">{company.name}</b>
            <span className={muted}>{[company.industry, company.size, company.location].filter(Boolean).join(' · ')}</span>
            <span className={muted}>{t('emp.openCount').replace('{count}', String(openJobs))}</span>
          </span>
        </div>
        {company.description && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-700 dark:text-slate-300">{company.description}</p>}
        {website && <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="self-start text-sm font-bold text-forest hover:underline dark:text-limeAccent">{website} ↗</a>}
        <p className="rounded-lg bg-[#F1F4F6] p-3 text-sm text-ink-700 dark:bg-slate-800 dark:text-slate-300">
          {t('emp.editSoon')} <Link href="/contact" className="font-bold text-forest hover:underline dark:text-limeAccent">{t('pricing.contact')}</Link>
        </p>
      </section>
      <section className={`${card} flex flex-col gap-1.5`}>
        <div className="flex items-center justify-between gap-3">
          <b className="text-[15px] text-ink-900 dark:text-white">{t('emp.verification')}</b>
          <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${company.verified ? 'bg-[#EEF5EF] text-forest dark:bg-forest/30 dark:text-limeAccent' : 'bg-[#F1F4F6] text-ink-500 dark:bg-slate-800 dark:text-slate-300'}`}>
            {t(company.verified ? 'emp.verified' : 'emp.notVerified')}
          </span>
        </div>
        {!company.verified && <p className="text-sm leading-normal text-ink-500 dark:text-slate-300">{t('emp.verifySoon')}</p>}
      </section>
    </>
  );
}
