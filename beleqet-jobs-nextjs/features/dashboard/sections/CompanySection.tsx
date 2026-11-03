'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { initials, safeHttpUrl } from '@/features/jobs/format';
import { uploadAttachment } from '@/features/freelance/actions';
import { apiGet, apiSend } from '../api';
import { card, Empty, Failed, Field, Heading, input, muted, outline, solid } from '../ui';

type Company = {
  name: string;
  industry?: string | null;
  location?: string | null;
  size?: string | null;
  description?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  verified?: boolean;
  verificationStatus?: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationNote?: string | null;
};

const SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];
const MAX_BYTES = 10 * 1024 * 1024;

/** The employer's company: view, edit (logo included) and send a trade licence for verification. */
export default function CompanySection({ openJobs }: { openJobs: number }) {
  const { t } = useTranslation();
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Company | null>(null);
  const [busy, setBusy] = useState<'' | 'save' | 'logo' | 'licence'>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);
  const licenceRef = useRef<HTMLInputElement>(null);

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

  async function upload(file: File): Promise<string> {
    if (file.size > MAX_BYTES) throw new Error(t('emp.fileTooBig'));
    return uploadAttachment(file);
  }

  async function changeLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('logo');
    setError('');
    try {
      const logoUrl = await upload(file);
      setCompany(await apiSend<Company>('PATCH', '/users/company', { logoUrl }));
    } catch (problem) {
      setError(problem instanceof Error && problem.message === t('emp.fileTooBig') ? problem.message : t('emp.uploadFailed'));
    } finally {
      setBusy('');
    }
  }

  async function sendLicence(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('licence');
    setError('');
    try {
      const tradeLicenseUrl = await upload(file);
      const status = await apiSend<Partial<Company>>('POST', '/users/company/verification', { tradeLicenseUrl });
      setCompany({ ...company!, ...status });
      setNotice(t('emp.licenceSent'));
    } catch {
      setError(t('emp.licenceFailed'));
    } finally {
      setBusy('');
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft?.name.trim()) {
      setError(t('emp.nameNeeded'));
      return;
    }
    if (draft.website && !safeHttpUrl(draft.website)) {
      setError(t('postJob.errUrl'));
      return;
    }
    setBusy('save');
    setError('');
    try {
      const saved = await apiSend<Company>('PATCH', '/users/company', {
        name: draft.name.trim(),
        industry: draft.industry?.trim() || null,
        location: draft.location?.trim() || null,
        size: draft.size || null,
        description: draft.description?.trim() || null,
        website: draft.website?.trim() || '',
      });
      setCompany(saved);
      setEditing(false);
      setNotice(company!.verified && !saved.verified ? t('emp.renamedUnverified') : t('emp.companySaved'));
    } catch {
      setError(t('dash.saveFailed'));
    } finally {
      setBusy('');
    }
  }

  const website = safeHttpUrl(company.website);
  const logo = safeHttpUrl(company.logoUrl);
  const status = company.verified ? 'VERIFIED' : company.verificationStatus ?? 'NONE';
  const field = (key: keyof Company) => ({
    value: (draft?.[key] as string | null | undefined) ?? '',
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft({ ...draft!, [key]: event.target.value }),
  });

  return (
    <>
      <Heading title={t('emp.tabs.company')} sub={t('emp.companySub')} />
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="text-sm font-semibold text-forest dark:text-limeAccent">{notice}</p>}

      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded file on our storage
            <img src={logo} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-ink-200 object-cover dark:border-slate-700" />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-primary text-lg font-bold text-limeAccent" aria-hidden="true">{initials(company.name)}</span>
          )}
          <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
            <b className="text-lg text-ink-900 dark:text-white">{company.name}</b>
            <span className={muted}>{[company.industry, company.size, company.location].filter(Boolean).join(' · ')}</span>
            <span className={muted}>{t('emp.openCount').replace('{count}', String(openJobs))}</span>
          </span>
          <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={changeLogo} />
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={() => logoRef.current?.click()} disabled={busy !== ''} className={outline}>
              {t(busy === 'logo' ? 'emp.uploading' : logo ? 'emp.changeLogo' : 'emp.addLogo')}
            </button>
            {!editing && (
              <button type="button" onClick={() => { setDraft(company); setEditing(true); setNotice(''); }} className={outline}>{t('emp.editCompany')}</button>
            )}
          </span>
        </div>

        {editing ? (
          <form noValidate onSubmit={save} className="flex flex-col gap-4 border-t border-[#F1F4F6] pt-4 dark:border-slate-800">
            <Field label={t('postJob.company.name')}><input type="text" {...field('name')} className={input} /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('postJob.company.industry')}><input type="text" {...field('industry')} className={input} /></Field>
              <Field label={t('postJob.company.location')}><input type="text" {...field('location')} className={input} /></Field>
              <Field label={t('emp.size')}>
                <select {...field('size')} className={input}>
                  <option value="">{t('postJob.notSpecified')}</option>
                  {SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </Field>
              <Field label={t('postJob.company.website')}><input type="url" inputMode="url" placeholder="https://" {...field('website')} className={input} /></Field>
            </div>
            <Field label={t('postJob.company.description')}><textarea rows={4} {...field('description')} className={`${input} resize-y py-3 leading-normal`} /></Field>
            {company.verified && <p className={muted}>{t('emp.renameWarning')}</p>}
            <span className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy !== ''} className={solid}>{t(busy === 'save' ? 'postJob.saving' : 'postJob.save')}</button>
              <button type="button" onClick={() => setEditing(false)} className={outline}>{t('postJob.cancel')}</button>
            </span>
          </form>
        ) : (
          <>
            {company.description && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-700 dark:text-slate-300">{company.description}</p>}
            {website && <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="self-start text-sm font-bold text-forest hover:underline dark:text-limeAccent">{website} ↗</a>}
          </>
        )}
      </section>

      <section className={`${card} flex flex-col gap-2`}>
        <div className="flex items-center justify-between gap-3">
          <b className="text-[15px] text-ink-900 dark:text-white">{t('emp.verification')}</b>
          <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${status === 'VERIFIED' ? 'bg-[#EEF5EF] text-forest dark:bg-forest/30 dark:text-limeAccent' : status === 'REJECTED' ? 'bg-[#FDECEC] text-[#9B2C2C] dark:bg-red-900/30 dark:text-red-200' : 'bg-[#F1F4F6] text-ink-500 dark:bg-slate-800 dark:text-slate-300'}`}>
            {t(`emp.verifyStatus.${status}`)}
          </span>
        </div>
        <p className="text-sm leading-normal text-ink-500 dark:text-slate-300">{t(`emp.verifyText.${status}`)}</p>
        {status === 'REJECTED' && company.verificationNote && (
          <p className="rounded-lg bg-[#FDECEC] p-3 text-sm text-ink-900 dark:bg-red-900/20 dark:text-slate-200">{company.verificationNote}</p>
        )}
        {(status === 'NONE' || status === 'REJECTED') && (
          <>
            <input ref={licenceRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={sendLicence} />
            <button type="button" onClick={() => licenceRef.current?.click()} disabled={busy !== ''} className={`${solid} self-start`}>
              {t(busy === 'licence' ? 'emp.uploading' : 'emp.sendLicence')}
            </button>
          </>
        )}
      </section>
    </>
  );
}
