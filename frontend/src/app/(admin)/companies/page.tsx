'use client';

import { useState } from 'react';
import { Badge, Dialog, Empty, Failed, Field, Heading, Loading, Notice, Segmented, card, input, link, muted, outline, row, solid, useAction, useResource } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, fullName, safeHttpUrl } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type Status = 'PENDING' | 'VERIFIED' | 'REJECTED';
type Company = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  tradeLicenseUrl: string | null;
  verificationStatus: Status;
  verificationRequestedAt: string | null;
  verificationNote: string | null;
  user: { email: string; firstName: string; lastName: string };
};

/** Trade licences employers uploaded: verify the company, or reject with a reason they will see. */
export default function CompaniesPage() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<Status>('PENDING');
  const companies = useResource((signal) => api<Company[]>(`/admin/companies/verification?status=${status}`, { signal }), status);
  const action = useAction();
  const [rejecting, setRejecting] = useState<{ company: Company; note: string } | null>(null);

  const decide = (company: Company, decision: 'VERIFIED' | 'REJECTED', note?: string) =>
    action
      .run(
        () => api(`/admin/companies/${company.id}/verification`, { method: 'PATCH', body: { decision, note } }),
        decision === 'VERIFIED' ? t('companies.verified', { name: company.name }) : t('companies.rejected', { name: company.name }),
      )
      .then((ok) => {
        if (ok) {
          setRejecting(null);
          companies.reload();
        }
      });

  return (
    <>
      <Heading title={t('nav.companies')} sub={t('companies.sub')} />
      <Segmented
        label={t('companies.filter')}
        value={status}
        onChange={setStatus}
        options={(['PENDING', 'VERIFIED', 'REJECTED'] as const).map((value) => ({ value, label: t(`companies.status.${value}`) }))}
      />
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
      <section className={card}>
        {companies.error && <Failed message={companies.error} onRetry={companies.reload} />}
        {companies.loading && <Loading />}
        {companies.data?.length === 0 && <Empty title={t(`companies.none.${status}`)} />}
        {companies.data?.map((company) => {
          const licence = safeHttpUrl(company.tradeLicenseUrl);
          const website = safeHttpUrl(company.website);
          return (
            <div key={company.id} className={row}>
              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-ink-900 dark:text-white">{company.name}</b>
                  {status !== 'PENDING' && <Badge tone={status === 'VERIFIED' ? 'green' : 'red'}>{t(`companies.status.${status}`)}</Badge>}
                </span>
                <span className={muted}>
                  {[company.industry, company.location].filter(Boolean).join(' · ')}
                  {company.industry || company.location ? ' · ' : ''}
                  {fullName(company.user)} ({company.user.email})
                </span>
                {company.verificationRequestedAt && <span className={muted}>{t('companies.sent', { date: formatDate(company.verificationRequestedAt, locale) })}</span>}
                {company.verificationNote && <span className="text-ink-700 dark:text-slate-300">{t('companies.note', { note: company.verificationNote })}</span>}
                <span className="flex flex-wrap gap-3">
                  {licence ? <a href={licence} target="_blank" rel="noreferrer" className={link}>{t('companies.openLicence')}</a> : <span className={muted}>{t('companies.noLicence')}</span>}
                  {website && <a href={website} target="_blank" rel="noreferrer" className={link}>{t('companies.website')}</a>}
                </span>
              </div>
              {status === 'PENDING' && (
                <div className="flex gap-2">
                  <button type="button" disabled={action.busy} className={outline} onClick={() => setRejecting({ company, note: '' })}>{t('companies.reject')}</button>
                  <button type="button" disabled={action.busy} className={solid} onClick={() => decide(company, 'VERIFIED')}>{t('companies.verify')}</button>
                </div>
              )}
            </div>
          );
        })}
      </section>
      {rejecting && (
        <Dialog
          title={t('companies.rejectTitle', { name: rejecting.company.name })}
          confirm={t('companies.reject')}
          busy={action.busy}
          disabled={!rejecting.note.trim()}
          onCancel={() => setRejecting(null)}
          onConfirm={() => decide(rejecting.company, 'REJECTED', rejecting.note.trim())}
        >
          <Field label={t('companies.reason')} hint={t('companies.reasonHint')}>
            <textarea rows={3} value={rejecting.note} onChange={(e) => setRejecting({ ...rejecting, note: e.target.value })} className={`${input} py-2`} />
          </Field>
        </Dialog>
      )}
    </>
  );
}
