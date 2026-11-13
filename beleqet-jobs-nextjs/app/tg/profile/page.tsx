'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation, type SupportedLocale } from '@/lib/i18n';
import { apiSend, fetchProfile, type Profile } from '@/features/dashboard/api';
import { countryName } from '@/features/dashboard/residence';
import { safeHttpUrl } from '@/features/jobs/format';
import { Band, CompanyMark, TabBar, card, muted } from '@/features/miniapp/ui';

/** What the account holds, in the Mini App. Editing happens on the profile page of the website. */
export default function MiniAppProfile() {
  const { t, locale, setLocale } = useTranslation();
  const { user, ready } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ready && user) fetchProfile().then(setProfile).catch(() => setFailed(true));
  }, [ready, user]);

  // The bot speaks the same language: it reads the one saved on the account.
  function chooseLanguage(next: SupportedLocale) {
    setLocale(next);
    void apiSend('PATCH', '/users/notification-preferences', { language: next }).catch(() => undefined);
  }

  if (ready && !user) return <p className={`${muted} p-6 text-center`}>{t('mini.apps.signedOut')}</p>;
  if (failed) return <p className={`${muted} p-6 text-center`}>{t('mini.profile.failed')}</p>;
  if (!profile) return <div className="min-h-[60vh]" aria-busy="true" />;

  const name = `${profile.firstName} ${profile.lastName}`.trim();
  const cv = safeHttpUrl(profile.defaultResumeUrl);
  const rows = [
    { k: t('mini.profile.phone'), v: profile.phone || t('mini.profile.notGiven') },
    {
      k: t('mini.profile.livesIn'),
      v: [profile.city, profile.country ? countryName(profile.country, locale) : null].filter(Boolean).join(', ') || t('mini.profile.notGiven'),
    },
    { k: t('mini.profile.gender'), v: profile.gender ? t(`postJob.genders.${profile.gender}`) : t('mini.profile.notGiven') },
    { k: t('mini.profile.email'), v: profile.email || t('mini.profile.noEmail') },
  ];

  return (
    <>
      <Band>
        <div className="flex items-center gap-3.5">
          {safeHttpUrl(profile.avatarUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded or Telegram photo
            <img src={safeHttpUrl(profile.avatarUrl)!} alt="" className="h-[60px] w-[60px] shrink-0 rounded-full object-cover" />
          ) : (
            <span className="rounded-full">
              <CompanyMark name={name} size={60} />
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <b className="font-display text-xl font-bold tracking-[-0.02em]">{name}</b>
            <span className="truncate text-sm text-white/75">
              {[profile.headline, profile.telegramUsername ? `@${profile.telegramUsername}` : null].filter(Boolean).join(' · ')}
            </span>
          </span>
          <Link href="/dashboard?tab=profile" className="shrink-0 rounded-xl border border-white/25 px-3 py-2 text-sm font-bold text-white">
            {t('mini.profile.edit')}
          </Link>
        </div>
      </Band>

      <main className="flex flex-1 flex-col gap-3 p-4">
        <dl className={`${card} flex flex-col px-3.5`}>
          {rows.map((row, i) => (
            <div key={row.k} className={`flex min-h-[50px] items-center gap-2.5 ${i ? 'border-t border-ink-100 dark:border-slate-800' : ''}`}>
              <dt className="w-28 shrink-0 text-[13px] text-mini-muted dark:text-slate-400">{row.k}</dt>
              <dd className="min-w-0 flex-1 break-words text-sm font-semibold">{row.v}</dd>
            </div>
          ))}
        </dl>

        {cv ? (
          <a href={cv} target="_blank" rel="noopener noreferrer" className={`${card} flex items-center gap-3 p-3.5`}>
            <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-lg bg-[#FDECEC] text-[11px] font-extrabold text-[#9B2C2C]">CV</span>
            <span className="flex flex-col gap-0.5">
              <b className="text-sm">{t('mini.profile.cv')}</b>
              <span className={muted}>{t('mini.profile.cvHint')}</span>
            </span>
          </a>
        ) : (
          <Link href="/dashboard?tab=profile" className={`${card} flex flex-col gap-1 p-3.5`}>
            <b className="text-sm">{t('mini.profile.noCv')}</b>
            <span className={muted}>{t('mini.profile.noCvHint')}</span>
          </Link>
        )}

        {!profile.email && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-mini-limeDeep bg-mini-lime/10 p-3.5">
            <b className="text-sm">{t('mini.profile.addEmailTitle')}</b>
            <span className={muted}>{t('mini.profile.addEmailText')}</span>
            <Link href="/dashboard?tab=settings" className="self-start py-2 text-sm font-extrabold text-mini-tag dark:text-mini-lime">{t('mini.profile.addEmail')}</Link>
          </div>
        )}

        <div role="group" aria-label={t('mini.profile.language')} className={`${card} flex items-center justify-between gap-3 p-3.5`}>
          <b className="text-sm">{t('mini.profile.language')}</b>
          <span className="flex gap-1.5">
            {(['en', 'am'] as const).map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={locale === code}
                onClick={() => chooseLanguage(code)}
                className={`h-9 rounded-full px-3.5 text-sm font-bold ${locale === code ? 'bg-mini-ink text-mini-lime dark:bg-mini-lime dark:text-mini-onLime' : 'border border-ink-300 dark:border-slate-700'}`}
              >
                {code === 'en' ? 'English' : 'አማርኛ'}
              </button>
            ))}
          </span>
        </div>
      </main>
      <TabBar />
    </>
  );
}
