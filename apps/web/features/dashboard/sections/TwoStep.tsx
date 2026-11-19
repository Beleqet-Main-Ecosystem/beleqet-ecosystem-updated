'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from '@/lib/i18n';
import { apiGet, apiSend } from '../api';
import { card, Field, input, muted, outline, solid } from '../ui';

type Status = { enabled: boolean; backupCodesLeft: number };
type Enrollment = { qrCode: string; secret: string; enrollmentToken: string };
// What the card is asking for: nothing, the app setup, a code to turn off, a code for new backup codes.
type Step = 'idle' | 'setup' | 'disable' | 'regenerate';

/** Two-step sign-in with an authenticator app: turn on, turn off, and replace backup codes. */
export default function TwoStep() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    apiGet<Status>('/auth/2fa/status').then(setStatus).catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  function reset(next: Step = 'idle') {
    setStep(next);
    setCode('');
    setError('');
  }

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch {
      setError(t(failure));
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    run(async () => {
      setEnrollment(await apiSend<Enrollment>('POST', '/auth/2fa/enroll'));
      reset('setup');
    }, 'twoStep.startFailed');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(t('twoStep.codeFormat'));
      return;
    }
    if (step === 'setup') {
      void run(async () => {
        const result = await apiSend<{ backupCodes: string[] }>('POST', '/auth/2fa/confirm', { enrollmentToken: enrollment!.enrollmentToken, code });
        setCodes(result.backupCodes);
        setEnrollment(null);
        setStatus({ enabled: true, backupCodesLeft: result.backupCodes.length });
        reset();
      }, 'twoStep.wrongCode');
    } else if (step === 'disable') {
      void run(async () => {
        await apiSend('POST', '/auth/2fa/disable', { code });
        setStatus({ enabled: false, backupCodesLeft: 0 });
        setCodes(null);
        reset();
      }, 'twoStep.wrongCode');
    } else if (step === 'regenerate') {
      void run(async () => {
        const { stepUpToken } = await apiSend<{ stepUpToken: string }>('POST', '/auth/2fa/challenge', { action: 'regenerate_backup_codes' });
        const result = await apiSend<{ backupCodes: string[] }>('POST', '/auth/2fa/backup-codes/regenerate', { stepUpToken, code });
        setCodes(result.backupCodes);
        setStatus({ enabled: true, backupCodesLeft: result.backupCodes.length });
        reset();
      }, 'twoStep.wrongCode');
    }
  }

  function download() {
    const blob = new Blob([`${t('twoStep.fileHeading')}\n\n${codes!.join('\n')}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'beleqet-backup-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const title = 'text-lg font-bold text-ink-900 dark:text-white';
  const codeField = (
    <Field label={t('twoStep.codeLabel')}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
        className={`${input} max-w-[200px] tracking-[0.3em]`}
      />
    </Field>
  );

  return (
    <section className={`${card} flex flex-col gap-3`} aria-labelledby="two-step-h">
      <h2 id="two-step-h" className={title}>{t('twoStep.title')}</h2>
      {failed && (
        <p role="alert" className="text-sm text-ink-700 dark:text-slate-300">
          {t('twoStep.loadFailed')} <button type="button" onClick={load} className="font-bold text-forest underline dark:text-limeAccent">{t('freelance.retry')}</button>
        </p>
      )}

      {status && step === 'idle' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
            <b className="text-[15px] text-ink-900 dark:text-white">{t(status.enabled ? 'twoStep.on' : 'twoStep.off')}</b>
            <span className={muted}>
              {status.enabled ? t('twoStep.codesLeft').replace('{count}', String(status.backupCodesLeft)) : t('twoStep.offText')}
            </span>
          </span>
          {status.enabled ? (
            <span className="flex flex-wrap gap-2">
              <button type="button" onClick={() => reset('regenerate')} className={outline}>{t('twoStep.newCodes')}</button>
              <button type="button" onClick={() => reset('disable')} className={outline}>{t('twoStep.turnOff')}</button>
            </span>
          ) : (
            <button type="button" onClick={start} disabled={busy} className={solid}>{t('twoStep.turnOn')}</button>
          )}
        </div>
      )}

      {step === 'setup' && enrollment && (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-700 dark:text-slate-300">
            <li>{t('twoStep.step1')}</li>
            <li>{t('twoStep.step2')}</li>
            <li>{t('twoStep.step3')}</li>
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the API */}
            <img src={enrollment.qrCode} alt={t('twoStep.qrAlt')} width={180} height={180} className="rounded-lg border border-ink-200 bg-white p-1 dark:border-slate-700" />
            <span className="flex min-w-0 flex-col gap-1">
              <span className={muted}>{t('twoStep.manual')}</span>
              <code className="break-all rounded-md bg-[#F1F4F6] px-2 py-1 text-sm font-semibold text-ink-900 dark:bg-slate-800 dark:text-white">{enrollment.secret}</code>
            </span>
          </div>
          {codeField}
          {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
          <span className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={solid}>{t('twoStep.confirm')}</button>
            <button type="button" onClick={() => { setEnrollment(null); reset(); }} className={outline}>{t('postJob.cancel')}</button>
          </span>
        </form>
      )}

      {(step === 'disable' || step === 'regenerate') && (
        <form noValidate onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-ink-700 dark:text-slate-300">{t(step === 'disable' ? 'twoStep.disableText' : 'twoStep.regenerateText')}</p>
          {codeField}
          {error && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>}
          <span className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={solid}>{t(step === 'disable' ? 'twoStep.turnOff' : 'twoStep.newCodes')}</button>
            <button type="button" onClick={() => reset()} className={outline}>{t('postJob.cancel')}</button>
          </span>
        </form>
      )}

      {codes && step === 'idle' && (
        <div className="flex flex-col gap-3 rounded-lg border border-[#B9D88A] bg-[#F1F7EC] p-4 dark:border-limeAccent/40 dark:bg-slate-950">
          <b className="text-[15px] text-ink-900 dark:text-white">{t('twoStep.codesTitle')}</b>
          <span className="text-sm text-ink-700 dark:text-slate-300">{t('twoStep.codesText')}</span>
          <ul className="m-0 grid list-none grid-cols-2 gap-1.5 p-0 font-mono text-[15px] text-ink-900 sm:grid-cols-5 dark:text-white">
            {codes.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <span className="flex flex-wrap gap-2">
            <button type="button" onClick={download} className={outline}>{t('twoStep.download')}</button>
            <button type="button" onClick={() => setCodes(null)} className={solid}>{t('twoStep.saved')}</button>
          </span>
        </div>
      )}
    </section>
  );
}
