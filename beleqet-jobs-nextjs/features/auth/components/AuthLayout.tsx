'use client';

import { Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export type BrandVariant = 'JOB_SEEKER' | 'EMPLOYER' | 'FREELANCER';

/**
 * Split auth screen: brand panel (desktop only) and the form column. The
 * brand copy follows the role being signed up for, so it always speaks to
 * what that person came to do.
 */
export default function AuthLayout({ brand = 'JOB_SEEKER', children }: { brand?: BrandVariant; children: React.ReactNode }) {
  const { t } = useTranslation();
  const key = `auth.brand.${brand}`;

  return (
    <div className="flex min-h-[calc(100vh-72px)] bg-canvas dark:bg-slate-950">
      <aside
        aria-hidden="true"
        className="hidden w-[44%] shrink-0 flex-col justify-between gap-10 bg-primary bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:56px_56px] px-10 py-12 text-white lg:flex xl:px-16"
      >
        <span />
        <div className="flex max-w-[460px] flex-col gap-5">
          <p className="text-[clamp(32px,3.2vw,44px)] font-extrabold leading-[1.08] tracking-[-0.035em]">{t(`${key}.title`)}</p>
          <ul className="flex flex-col gap-3.5">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex items-start gap-3 text-base leading-normal text-white/80">
                <span className="mt-px grid h-6 w-6 shrink-0 place-items-center rounded-full bg-limeAccent text-obsidian">
                  <Check className="h-[13px] w-[13px]" strokeWidth={3} />
                </span>
                {t(`${key}.point${n}`)}
              </li>
            ))}
          </ul>
        </div>
        <span className="text-[13px] text-white/55">{t('auth.brand.footer')}</span>
      </aside>

      <main className="flex flex-1 justify-center px-4 pb-12 pt-8 sm:px-6 md:pt-14">
        <div className="flex w-full max-w-[440px] flex-col gap-[22px]">{children}</div>
      </main>
    </div>
  );
}
