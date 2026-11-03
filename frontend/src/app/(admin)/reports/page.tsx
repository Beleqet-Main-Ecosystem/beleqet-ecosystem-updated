'use client';

import { useState } from 'react';
import { Dialog, Empty, Failed, Heading, Loading, Notice, card, link, muted, outline, row, solid, useAction, useResource } from '@/components/ui';
import { api } from '@/lib/api';
import { SITE_URL, formatDateTime, fullName } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

type Report = {
  id: string;
  targetType: 'JOB' | 'FORUM_THREAD' | 'FORUM_REPLY';
  targetId: string;
  targetTitle: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
  reporter: { firstName: string; lastName: string; email: string };
};

/** Content people reported: dismiss it, or remove the content for everyone. */
export default function ReportsPage() {
  const { t, locale } = useI18n();
  const reports = useResource((signal) => api<Report[]>('/reports/admin', { signal }), 'reports');
  const action = useAction();
  const [removing, setRemoving] = useState<Report | null>(null);

  const decide = (report: Report, decision: 'dismiss' | 'remove') =>
    action
      .run(() => api(`/reports/admin/${report.id}`, { method: 'PATCH', body: { action: decision } }), decision === 'remove' ? t('reports.removed') : t('reports.dismissed'))
      .then((ok) => {
        if (ok) {
          setRemoving(null);
          reports.reload();
        }
      });

  return (
    <>
      <Heading title={t('nav.reports')} sub={t('reports.sub')} />
      <Notice notice={action.notice} onClose={() => action.setNotice(null)} />
      <section className={card}>
        {reports.error && <Failed message={reports.error} onRetry={reports.reload} />}
        {reports.loading && <Loading />}
        {reports.data?.length === 0 && <Empty title={t('reports.none')} text={t('reports.noneText')} />}
        {reports.data?.map((report) => (
          <div key={report.id} className={row}>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1 text-sm">
              <span>
                <b className="text-ink-900 dark:text-white">{report.targetTitle ?? t('reports.gone')}</b>{' '}
                <span className={muted}>· {t(`reports.type.${report.targetType}`)}</span>
              </span>
              <span className="text-ink-700 dark:text-slate-300">
                {t(`reports.reason.${report.reason}`)}{report.details ? ` — ${report.details}` : ''}
              </span>
              <span className={muted}>{t('reports.by', { name: fullName(report.reporter), email: report.reporter.email, date: formatDateTime(report.createdAt, locale) })}</span>
              {report.targetType === 'JOB' && (
                <a href={`${SITE_URL}/jobs/${report.targetId}`} target="_blank" rel="noreferrer" className={`${link} text-sm`}>{t('reports.openJob')}</a>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={action.busy} className={outline} onClick={() => decide(report, 'dismiss')}>{t('reports.dismiss')}</button>
              <button type="button" disabled={action.busy} className={solid} onClick={() => setRemoving(report)}>{t('reports.remove')}</button>
            </div>
          </div>
        ))}
      </section>
      {removing && (
        <Dialog
          title={t('reports.removeTitle')}
          text={t('reports.removeText', { title: removing.targetTitle ?? t('reports.gone') })}
          confirm={t('reports.remove')}
          tone="danger"
          busy={action.busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => decide(removing, 'remove')}
        />
      )}
    </>
  );
}
