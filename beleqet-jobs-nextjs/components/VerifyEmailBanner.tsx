'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MailWarning, X } from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const DISMISS_KEY = 'beleqet_verify_banner_dismissed';
/** Addresses the platform invents for Telegram sign-ups: there is no inbox to confirm. */
const PLACEHOLDER = /@(beleqet\.internal|tme\.beleqet\.local)$/i;

/**
 * Asks signed-in people to confirm their email. Posting jobs and projects, applying, bidding and
 * paying need it (the API refuses them otherwise), so the banner offers a fresh link.
 */
export default function VerifyEmailBanner() {
  const { user, ready } = useAuth();
  const { t } = useTranslation();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setEmail(null);
    if (!ready || !user) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === user.id) {
        setHidden(true);
        return;
      }
    } catch {
      // Storage can be blocked; the banner then simply shows.
    }
    let active = true;
    authenticatedFetch(`${API_URL}/users/profile`)
      .then((response) => (response.ok ? response.json() : null))
      .then((profile: { email?: string; emailVerified?: boolean } | null) => {
        if (active && profile?.emailVerified === false && profile.email && !PLACEHOLDER.test(profile.email)) {
          setEmail(profile.email);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [ready, user]);

  // The home page has its own design, and the verify page is where the link lands.
  if (!user || !email || hidden || pathname === '/' || pathname.startsWith('/auth/verify-email')) return null;

  async function resend() {
    setState('sending');
    try {
      const response = await authenticatedFetch(`${API_URL}/auth/resend-verification`, { method: 'POST' });
      setState(response.ok ? 'sent' : 'failed');
    } catch {
      setState('failed');
    }
  }

  function dismiss() {
    setHidden(true);
    try {
      if (user) sessionStorage.setItem(DISMISS_KEY, user.id);
    } catch {
      // Without storage it just comes back on the next page.
    }
  }

  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm">
        <MailWarning className="h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1">{t('auth.verifyBanner.message').replace('{email}', email)}</p>
        {state === 'sent' ? (
          <span className="font-semibold">{t('auth.verifyBanner.sent')}</span>
        ) : (
          <button type="button" onClick={resend} disabled={state === 'sending'} className="font-bold underline underline-offset-2 disabled:opacity-60">
            {t(state === 'sending' ? 'auth.verifyBanner.sending' : 'auth.verifyBanner.send')}
          </button>
        )}
        {state === 'failed' && <span className="font-semibold text-red-700 dark:text-red-300">{t('auth.verifyBanner.failed')}</span>}
        <button type="button" onClick={dismiss} aria-label={t('auth.verifyBanner.dismiss')} className="rounded p-1 hover:bg-amber-100 dark:hover:bg-amber-900">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
