'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { completeOAuth, OAUTH_NEXT_KEY, OAUTH_TWO_FACTOR_KEY } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { homeFor, safeNextPath } from '@/features/auth/redirect';

/** Google and LinkedIn send people here with the session (or a two-step challenge) in the URL fragment. */
export default function OAuthCallbackPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setUser } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    // Drop the tokens from the address bar and history straight away.
    window.history.replaceState(null, '', window.location.pathname);
    let next: string | null = null;
    try {
      next = safeNextPath(sessionStorage.getItem(OAUTH_NEXT_KEY));
      sessionStorage.removeItem(OAUTH_NEXT_KEY);
    } catch {
      // Storage blocked: fall back to the role's home.
    }

    const twoFactor = params.get('twoFactor');
    if (twoFactor) {
      try {
        sessionStorage.setItem(OAUTH_TWO_FACTOR_KEY, twoFactor);
      } catch {
        setFailed(true);
        return;
      }
      router.replace(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
      return;
    }

    const access = params.get('access');
    const refresh = params.get('refresh');
    if (!access || !refresh) {
      setFailed(true);
      return;
    }
    completeOAuth(access, refresh)
      .then((user) => {
        setUser(user);
        router.replace(next ?? homeFor(user));
      })
      .catch(() => setFailed(true));
  }, [router, setUser]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[480px] flex-col items-center justify-center gap-3 px-4 text-center">
      {failed ? (
        <>
          <p role="alert" className="text-[15px] font-semibold text-ink-900 dark:text-white">{t('auth.oauthFailed')}</p>
          <Link href="/login" className="font-bold text-forest hover:underline dark:text-limeAccent">{t('auth.backToSignIn')}</Link>
        </>
      ) : (
        <p role="status" className="text-[15px] text-ink-500 dark:text-slate-400">{t('auth.signingIn')}</p>
      )}
    </div>
  );
}
