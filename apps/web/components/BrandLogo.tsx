'use client';

import Image from 'next/image';
import { useTranslation } from '@/lib/i18n';

/**
 * The Beleqet lockup: the handshake mark, the wordmark and a small "Jobs · Freelance" line.
 * `tone="light"` is for dark backgrounds (the footer).
 */
export default function BrandLogo({ tone = 'dark', priority = false }: { tone?: 'dark' | 'light'; priority?: boolean }) {
  const { t } = useTranslation();
  const light = tone === 'light';
  return (
    <span className="flex items-center gap-2.5">
      <Image
        src="/logo-mark.png"
        alt=""
        width={40}
        height={40}
        priority={priority}
        className={`h-10 w-10 rounded-[11px] ${light ? 'ring-1 ring-white/20' : 'shadow-[0_6px_16px_-8px_rgba(7,59,37,0.7)]'}`}
      />
      <span className="flex flex-col">
        <span
          className={`font-display text-[21px] font-extrabold leading-none tracking-[-0.035em] ${
            light ? 'text-white' : 'text-primary dark:text-white'
          }`}
        >
          Beleqet<span className="text-[#7ED957]">.</span>
        </span>
        <span
          className={`mt-[5px] text-[10px] font-bold uppercase leading-none tracking-[0.18em] ${
            light ? 'text-white/55' : 'text-ink-500 dark:text-slate-400'
          }`}
        >
          {t('header.brandTagline')}
        </span>
      </span>
    </span>
  );
}
