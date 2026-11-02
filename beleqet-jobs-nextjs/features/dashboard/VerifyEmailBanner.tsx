'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { apiSend, fetchProfile } from './api';

/** Reminds people with an unverified email, with a button to send a fresh link. */
export default function VerifyEmailBanner() {
  const { t } = useTranslation();
  const [unverified, setUnverified] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  useEffect(() => {
    fetchProfile().then((profile) => setUnverified(profile.emailVerified === false)).catch(() => undefined);
  }, []);

  if (!unverified) return null;

  async function resend() {
    setState('sending');
    try {
      await apiSend('POST', '/auth/resend-verification');
      setState('sent');
    } catch {
      setState('failed');
    }
  }

  return (
    <div role="note" className="flex flex-wrap items-center gap-3 rounded-xl border border-[#F2D58A] bg-[#FFF8E6] px-4 py-3.5 dark:border-amber-500/40 dark:bg-amber-500/10">
      <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
        <b className="text-[15px] text-ink-900 dark:text-white">{t('dash.verifyTitle')}</b>
        <span className="text-sm text-ink-700 dark:text-slate-300">
          {t(state === 'sent' ? 'dash.verifySent' : state === 'failed' ? 'dash.verifyFailed' : 'dash.verifyText')}
        </span>
      </span>
      {state !== 'sent' && (
        <button type="button" onClick={resend} disabled={state === 'sending'} className="inline-flex min-h-11 items-center rounded-lg bg-obsidian px-4 text-sm font-bold text-limeAccent disabled:opacity-60 dark:bg-limeAccent dark:text-obsidian">
          {t(state === 'sending' ? 'dash.verifySending' : 'dash.verifyResend')}
        </button>
      )}
    </div>
  );
}
