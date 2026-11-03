'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { initials, safeHttpUrl } from '@/features/jobs/format';
import { uploadAttachment } from '@/features/freelance/actions';
import { apiGet, apiSend, fetchProfile, type Profile } from '../api';
import { card, Failed, Field, Heading, input, link, muted, outline, solid } from '../ui';

type Slot = { id: string; startTime: string; endTime: string };

const TEXT_FIELDS = ['firstName', 'lastName', 'headline', 'location', 'phone'] as const;
const LINK_FIELDS = ['linkedinUrl', 'portfolioUrl', 'githubUrl'] as const;

export default function ProfileSection() {
  const { t, locale } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [failed, setFailed] = useState(false);
  const [skill, setSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [slotError, setSlotError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setFailed(false);
    fetchProfile().then(setProfile).catch(() => setFailed(true));
    apiGet<Slot[]>('/interview-planner/availability').then((rows) => setSlots(rows ?? [])).catch(() => setSlots([]));
  }, []);
  useEffect(load, [load]);

  if (failed) return <Failed onRetry={load} />;
  if (!profile) return <div className="min-h-[40vh]" />;

  async function setPhoto(avatarUrl: string | null) {
    setPhotoBusy(true);
    setError('');
    try {
      await apiSend('PATCH', '/users/profile', { avatarUrl: avatarUrl ?? '' });
      setProfile({ ...profile!, avatarUrl });
    } catch {
      setError(t('dash.saveFailed'));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError(t('emp.fileTooBig'));
      return;
    }
    setPhotoBusy(true);
    try {
      const url = await uploadAttachment(file);
      await setPhoto(url);
    } catch {
      setError(t('emp.uploadFailed'));
      setPhotoBusy(false);
    }
  }

  const change = (patch: Partial<Profile>) => {
    setSaved(false);
    setProfile({ ...profile, ...patch });
  };

  function addSkill() {
    const value = skill.trim();
    if (value && !profile!.skills.includes(value)) change({ skills: [...profile!.skills, value] });
    setSkill('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSaved(false);
    if (LINK_FIELDS.some((field) => profile![field] && !safeHttpUrl(profile![field]))) {
      setError(t('job.apply.portfolioInvalid'));
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { skills: profile!.skills, bio: profile!.bio ?? '' };
      for (const field of TEXT_FIELDS) body[field] = profile![field] ?? '';
      // An empty link clears it.
      for (const field of LINK_FIELDS) body[field] = profile![field] ? safeHttpUrl(profile![field]) : '';
      await apiSend('PATCH', '/users/profile', body);
      setSaved(true);
    } catch {
      setError(t('dash.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function addSlot() {
    setSlotError('');
    if (!start || !end || new Date(end) <= new Date(start)) {
      setSlotError(t('dash.errSlot'));
      return;
    }
    try {
      const slot = await apiSend<Slot>('POST', '/interview-planner/availability', { startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString() });
      setSlots([...slots, slot]);
      setStart('');
      setEnd('');
    } catch {
      setSlotError(t('freelance.gig.actionFailed'));
    }
  }

  async function removeSlot(id: string) {
    setSlotError('');
    try {
      await apiSend('DELETE', `/interview-planner/availability/${id}`);
      setSlots(slots.filter((slot) => slot.id !== id));
    } catch {
      setSlotError(t('freelance.gig.actionFailed'));
    }
  }

  const when = (iso: string) => new Date(iso).toLocaleString(locale === 'am' ? 'am-ET' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <Heading title={t('dash.profileTitle')} sub={t('dash.profileSub')} />
      <section className={`${card} flex flex-wrap items-center gap-4`} aria-label={t('dash.photo')}>
        {safeHttpUrl(profile.avatarUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded file on our storage
          <img src={safeHttpUrl(profile.avatarUrl)!} alt="" className="h-16 w-16 rounded-full border border-ink-200 object-cover dark:border-slate-700" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full bg-primary text-lg font-bold text-limeAccent" aria-hidden="true">
            {initials(`${profile.firstName} ${profile.lastName}`)}
          </span>
        )}
        <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
          <b className="text-[15px] text-ink-900 dark:text-white">{t('dash.photo')}</b>
          <span className={muted}>{t('dash.photoText')}</span>
        </span>
        <input ref={photoRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={changePhoto} />
        <span className="flex flex-wrap gap-2">
          <button type="button" onClick={() => photoRef.current?.click()} disabled={photoBusy} className={outline}>
            {t(photoBusy ? 'emp.uploading' : profile.avatarUrl ? 'dash.changePhoto' : 'dash.addPhoto')}
          </button>
          {profile.avatarUrl && (
            <button type="button" onClick={() => setPhoto(null)} disabled={photoBusy} className="min-h-11 px-2 text-sm font-semibold text-[#B42318] dark:text-red-300">
              {t('dash.removePhoto')}
            </button>
          )}
        </span>
      </section>
      <form noValidate onSubmit={save} className={`${card} flex flex-col gap-4`}>
        <h2 className="text-lg font-bold text-ink-900 dark:text-white">{t('dash.aboutYou')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {TEXT_FIELDS.map((field) => (
            <Field key={field} label={t(`dash.fields.${field}`)}>
              <input type={field === 'phone' ? 'tel' : 'text'} value={profile[field] ?? ''} onChange={(event) => change({ [field]: event.target.value })} className={input} />
            </Field>
          ))}
        </div>
        <Field label={t('dash.fields.bio')}>
          <textarea rows={4} value={profile.bio ?? ''} onChange={(event) => change({ bio: event.target.value })} className={`${input} resize-y py-3 leading-normal`} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-ink-900 dark:text-white">{t('postJob.skills')}</span>
          {profile.skills.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {profile.skills.map((item) => (
                <li key={item} className="inline-flex items-center gap-1 rounded-full bg-[#F1F4F6] py-1 pl-3 pr-1 text-sm font-semibold text-ink-700 dark:bg-slate-800 dark:text-slate-200">
                  {item}
                  <button type="button" aria-label={t('freelance.post2.removeSkill').replace('{skill}', item)} onClick={() => change({ skills: profile.skills.filter((value) => value !== item) })} className="grid h-7 w-7 place-items-center">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className="flex gap-2">
            <input
              type="text"
              aria-label={t('freelance.post2.addSkill')}
              placeholder={t('freelance.post2.addSkill')}
              value={skill}
              onChange={(event) => setSkill(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSkill();
                }
              }}
              className={input}
            />
            <button type="button" onClick={addSkill} className={outline}>{t('dash.add')}</button>
          </span>
        </div>
        <h2 className="text-lg font-bold text-ink-900 dark:text-white">{t('dash.links')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {LINK_FIELDS.map((field) => (
            <Field key={field} label={t(`dash.fields.${field}`)}>
              <input type="url" inputMode="url" placeholder="https://" value={profile[field] ?? ''} onChange={(event) => change({ [field]: event.target.value })} className={input} />
            </Field>
          ))}
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          {saved && <span role="status" className="text-sm font-bold text-forest dark:text-limeAccent">{t('dash.saved')}</span>}
          <button type="submit" disabled={saving} className={solid}>{t(saving ? 'postJob.saving' : 'dash.saveProfile')}</button>
        </div>
      </form>

      <section className={`${card} flex flex-col gap-3`}>
        <div>
          <h2 className="text-lg font-bold text-ink-900 dark:text-white">{t('dash.availability')}</h2>
          <span className={muted}>{t('dash.availabilitySub')}</span>
        </div>
        {slots.map((slot) => (
          <div key={slot.id} className="flex items-center justify-between gap-3 border-t border-[#F1F4F6] py-2 text-sm text-ink-900 dark:border-slate-800 dark:text-white">
            <span>{when(slot.startTime)} – {when(slot.endTime)}</span>
            <button type="button" onClick={() => removeSlot(slot.id)} className={outline}>{t('dash.remove')}</button>
          </div>
        ))}
        <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Field label={t('dash.from')}>
            <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className={input} />
          </Field>
          <Field label={t('dash.to')}>
            <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className={input} />
          </Field>
          <button type="button" onClick={addSlot} className={`${outline} min-h-12`}>+ {t('dash.addTime')}</button>
        </div>
        {slotError && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{slotError}</p>}
      </section>

      <section className={`${card} flex flex-col gap-2.5`}>
        <h2 className="text-lg font-bold text-ink-900 dark:text-white">{t('dash.yourCv')}</h2>
        {profile.defaultResumeUrl && safeHttpUrl(profile.defaultResumeUrl) ? (
          <a href={safeHttpUrl(profile.defaultResumeUrl)!} target="_blank" rel="noopener noreferrer" className={`text-sm ${link}`}>{t('dash.viewCv')} ↗</a>
        ) : (
          <p className={muted}>{t('dash.noCv')}</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Link href="/resume-brain" className={solid}>{t('dash.openBrain')}</Link>
          <Link href="/cv-maker" className={outline}>{t('dash.openCvMaker')}</Link>
        </div>
      </section>
    </>
  );
}
