'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { isPlaceholderEmail } from '@/lib/auth';
import { initials, safeHttpUrl } from '@/features/jobs/format';
import { uploadAttachment } from '@/features/freelance/actions';
import { apiGet, apiSend, fetchProfile, type Profile } from '../api';
import { COMPANY_LINKS, COMPANY_SIZES, companyLink, companyStatus, shortUrl, type Company } from '../company';
import { card, Empty, Failed, Field, Heading, input, muted, outline, solid } from '../ui';
import { errorText } from '@/lib/api-error';

/** The form's copy of the company: the year and the benefits are edited as text. */
type Draft = Omit<Company, 'foundedYear' | 'benefits'> & { foundedYear: string; benefits: string };

const MAX_BYTES = 10 * 1024 * 1024;
const FIRST_YEAR = 1800;
const MAX_BENEFITS = 20;

const toDraft = (company: Company): Draft => ({
  ...company,
  foundedYear: company.foundedYear ? String(company.foundedYear) : '',
  benefits: (company.benefits ?? []).join('\n'),
});

/** One benefit per line, without blanks or repeats. */
const parseBenefits = (text: string) => Array.from(new Set(text.split('\n').map((line) => line.trim().slice(0, 80)).filter(Boolean))).slice(0, MAX_BENEFITS);

/**
 * The employer's company: everything on its profile (logo and cover image included), the contact
 * details the employer registered with, and sending a trade licence for verification.
 * `editOnOpen` opens the form straight away (the Mini App's "Edit company details").
 */
export default function CompanySection({ openJobs, editOnOpen = false }: { openJobs?: number; editOnOpen?: boolean }) {
  const { t } = useTranslation();
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [contact, setContact] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<'' | 'save' | 'logo' | 'cover' | 'licence'>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const licenceRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setFailed(false);
    apiGet<Company | null>('/users/company')
      .then((loaded) => {
        setCompany(loaded);
        if (editOnOpen && loaded) {
          setDraft(toDraft(loaded));
          setEditing(true);
        }
      })
      .catch(() => setFailed(true));
    fetchProfile().then(setContact).catch(() => setContact(null));
  }, [editOnOpen]);
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

  /** Logo and cover image are saved as soon as they're chosen (or removed). */
  async function changeImage(kind: 'logo' | 'cover', event: ChangeEvent<HTMLInputElement> | null) {
    const file = event?.target.files?.[0];
    if (event) event.target.value = '';
    if (event && !file) return;
    setBusy(kind);
    setError('');
    try {
      const url = file ? await upload(file) : null;
      setCompany(await apiSend<Company>('PATCH', '/users/company', kind === 'logo' ? { logoUrl: url } : { coverImageUrl: url }));
    } catch (problem) {
      setError(problem instanceof Error && problem.message === t('emp.fileTooBig') ? problem.message : errorText(problem, t, 'emp.uploadFailed'));
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
    } catch (problem) {
      setError(errorText(problem, t, 'emp.licenceFailed'));
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
    if (COMPANY_LINKS.some(({ key }) => draft[key]?.trim() && !safeHttpUrl(draft[key]))) {
      setError(t('emp.errLink'));
      return;
    }
    const thisYear = new Date().getFullYear();
    const year = draft.foundedYear.trim() ? Number(draft.foundedYear.trim()) : null;
    if (year !== null && (!Number.isInteger(year) || year < FIRST_YEAR || year > thisYear)) {
      setError(t('emp.errYear').replace('{year}', String(thisYear)));
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
        foundedYear: year,
        description: draft.description?.trim() || null,
        benefits: parseBenefits(draft.benefits),
        // An empty link clears it; the rest are saved with https:// in front.
        ...Object.fromEntries(COMPANY_LINKS.map(({ key }) => [key, safeHttpUrl(draft[key]) ?? ''])),
      });
      setCompany(saved);
      setEditing(false);
      setNotice(company!.verified && !saved.verified ? t('emp.renamedUnverified') : t('emp.companySaved'));
    } catch (problem) {
      setError(errorText(problem, t, 'dash.saveFailed'));
    } finally {
      setBusy('');
    }
  }

  const logo = safeHttpUrl(company.logoUrl);
  const cover = safeHttpUrl(company.coverImageUrl);
  const status = companyStatus(company);
  const benefits = company.benefits ?? [];
  const field = (key: keyof Draft) => ({
    value: (draft?.[key] as string | null | undefined) ?? '',
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft({ ...draft!, [key]: event.target.value }),
  });
  const notAdded = <span className="font-normal text-ink-400 dark:text-slate-500">{t('emp.notAdded')}</span>;
  const contactName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : '';
  const contactEmail = contact?.email && !isPlaceholderEmail(contact.email) ? contact.email : null;

  return (
    <>
      <Heading title={t('emp.tabs.company')} sub={t('emp.companySub')} />
      {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="text-sm font-semibold text-forest dark:text-limeAccent">{notice}</p>}

      <section className={`${card} flex flex-col gap-4`}>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded file on our storage
          <img src={cover} alt="" className="-mx-5 -mt-5 h-32 w-[calc(100%+2.5rem)] max-w-none rounded-t-xl object-cover md:h-40" />
        )}
        <div className="flex flex-wrap items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded file on our storage
            <img src={logo} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-ink-200 object-cover dark:border-slate-700" />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-primary text-lg font-bold text-limeAccent" aria-hidden="true">{initials(company.name)}</span>
          )}
          <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
            <b className="text-lg text-ink-900 dark:text-white">{company.name}</b>
            <span className={muted}>
              {[t(`emp.verifyStatus.${status}`), openJobs === undefined ? null : t('emp.openCount').replace('{count}', String(openJobs))].filter(Boolean).join(' · ')}
            </span>
          </span>
          <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={(event) => changeImage('logo', event)} />
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={() => logoRef.current?.click()} disabled={busy !== ''} className={outline}>
              {t(busy === 'logo' ? 'emp.uploading' : logo ? 'emp.changeLogo' : 'emp.addLogo')}
            </button>
            {!editing && (
              <button type="button" onClick={() => { setDraft(toDraft(company)); setEditing(true); setNotice(''); }} className={outline}>{t('emp.editCompany')}</button>
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
                  {COMPANY_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </Field>
              <Field label={t('emp.foundedYear')}>
                <input type="text" inputMode="numeric" maxLength={4} placeholder="2015" {...field('foundedYear')} className={input} />
              </Field>
              {COMPANY_LINKS.map(({ key, label }) => (
                <Field key={key} label={t(label)}><input type="url" inputMode="url" placeholder="https://" {...field(key)} className={input} /></Field>
              ))}
            </div>
            <Field label={t('postJob.company.description')}><textarea rows={4} {...field('description')} className={`${input} resize-y py-3 leading-normal`} /></Field>
            <Field label={t('emp.benefits')}>
              <textarea rows={4} {...field('benefits')} placeholder={t('emp.benefitsHint')} className={`${input} resize-y py-3 leading-normal`} />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold text-ink-900 dark:text-white">{t('emp.cover')}</span>
              <span className={muted}>{t('emp.coverHint')}</span>
              <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={(event) => changeImage('cover', event)} />
              <span className="flex flex-wrap gap-2">
                <button type="button" onClick={() => coverRef.current?.click()} disabled={busy !== ''} className={outline}>
                  {t(busy === 'cover' ? 'emp.uploading' : cover ? 'emp.changeCover' : 'emp.addCover')}
                </button>
                {cover && <button type="button" onClick={() => changeImage('cover', null)} disabled={busy !== ''} className={outline}>{t('emp.removeCover')}</button>}
              </span>
            </div>
            {company.verified && <p className={muted}>{t('emp.renameWarning')}</p>}
            <span className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy !== ''} className={solid}>{t(busy === 'save' ? 'postJob.saving' : 'postJob.save')}</button>
              <button type="button" onClick={() => setEditing(false)} className={outline}>{t('postJob.cancel')}</button>
            </span>
          </form>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 border-t border-[#F1F4F6] pt-4 sm:grid-cols-2 dark:border-slate-800">
            <Detail wide label={t('postJob.company.description')}>
              {company.description ? <span className="whitespace-pre-line font-normal leading-relaxed text-ink-700 dark:text-slate-300">{company.description}</span> : notAdded}
            </Detail>
            <Detail label={t('postJob.company.industry')}>{company.industry || notAdded}</Detail>
            <Detail label={t('emp.size')}>{company.size || notAdded}</Detail>
            <Detail label={t('postJob.company.location')}>{company.location || notAdded}</Detail>
            <Detail label={t('emp.founded')}>{company.foundedYear || notAdded}</Detail>
            {COMPANY_LINKS.map(({ key, label }) => {
              const url = companyLink(company, key);
              return (
                <Detail key={key} label={t(label)}>
                  {url ? <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-forest hover:underline dark:text-limeAccent">{shortUrl(url)} ↗</a> : notAdded}
                </Detail>
              );
            })}
            <Detail wide label={t('emp.benefits')}>
              {benefits.length ? (
                <span className="mt-0.5 flex flex-wrap gap-1.5">
                  {benefits.map((benefit) => (
                    <span key={benefit} className="rounded-full bg-[#EEF5EF] px-2.5 py-1 text-[13px] font-semibold text-forest dark:bg-forest/30 dark:text-limeAccent">{benefit}</span>
                  ))}
                </span>
              ) : notAdded}
            </Detail>
          </dl>
        )}
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <div className="flex flex-col gap-0.5">
          <b className="text-[15px] text-ink-900 dark:text-white">{t('emp.contact')}</b>
          <span className={muted}>{t('emp.contactSub')}</span>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Detail label={t('emp.contactPerson')}>{contactName || notAdded}</Detail>
          <Detail label={t('emp.phone')}>{contact?.phone ? <a href={`tel:${contact.phone}`} className="text-forest hover:underline dark:text-limeAccent">{contact.phone}</a> : notAdded}</Detail>
          <Detail label={t('emp.email')}>{contactEmail ?? notAdded}</Detail>
          <Detail label={t('emp.telegram')}>{contact?.telegramUsername ? `@${contact.telegramUsername}` : notAdded}</Detail>
        </dl>
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

/** One labelled detail of the company; inside a <dl> it is a term and its value. */
function Detail({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className={muted}>{label}</dt>
      <dd className="m-0 break-words text-[15px] font-semibold text-ink-900 dark:text-white">{children}</dd>
    </div>
  );
}
