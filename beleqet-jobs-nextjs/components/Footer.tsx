'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from '@/lib/i18n';

const TELEGRAM_URL = 'https://t.me/BeleqetJobs';

const footerColumns = [
  {
    titleKey: 'footer.jobSeekers',
    links: [
      { labelKey: 'nav.findJobs', href: '/jobs' },
      { labelKey: 'nav.feed', href: '/feed' },
      { labelKey: 'nav.resumeBrain', href: '/resume-brain' },
      { labelKey: 'nav.cvMaker', href: '/cv-maker' },
      { labelKey: 'nav.portfolio', href: '/portfolio' },
      { labelKey: 'footer.telegramAlerts', href: TELEGRAM_URL },
    ],
  },
  {
    titleKey: 'footer.employers',
    links: [
      { labelKey: 'footer.postJob', href: '/post-job' },
      { labelKey: 'footer.employerDashboard', href: '/employer' },
      { labelKey: 'footer.pricing', href: '/pricing' },
    ],
  },
  {
    titleKey: 'nav.freelance',
    links: [
      { labelKey: 'footer.browseProjects', href: '/freelance' },
      { labelKey: 'footer.postProject', href: '/post-job?type=freelance' },
      { labelKey: 'footer.howEscrowWorks', href: '/#escrow' },
    ],
  },
  {
    titleKey: 'footer.company',
    links: [
      { labelKey: 'nav.about', href: '/about' },
      { labelKey: 'nav.forum', href: '/forum' },
      { labelKey: 'footer.contact', href: '/contact' },
      { labelKey: 'footer.privacy', href: '/privacy' },
    ],
  },
];

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-primary pb-24 text-white/75 lg:pb-0">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-10 px-4 pb-8 pt-16 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)] lg:px-10">
        <div className="col-span-2 flex flex-col gap-3.5 md:col-span-1">
          <Link
            href="/"
            className="flex items-center gap-2.5 self-start rounded-md text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limeAccent"
          >
            <Image src="/logo-icon.png" alt="" width={32} height={32} className="h-8 w-8 rounded-md object-contain" />
            <span className="text-lg font-extrabold tracking-[-0.02em]">
              Beleqet<span className="text-limeAccent">.</span>
            </span>
          </Link>
          <p className="max-w-xs text-sm leading-6">{t('footer.tagline')}</p>
        </div>

        {footerColumns.map((col) => (
          <nav key={col.titleKey} aria-label={t(col.titleKey)} className="flex flex-col gap-1">
            <h2 className="mb-2 text-[13px] font-bold text-white">{t(col.titleKey)}</h2>
            {col.links.map((link) => {
              const isExternal = link.href.startsWith('http');
              return (
                <Link
                  key={link.labelKey}
                  href={link.href}
                  {...(isExternal ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                  className="inline-flex min-h-9 items-center self-start rounded text-sm text-white/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limeAccent"
                >
                  {t(link.labelKey)}
                </Link>
              );
            })}
          </nav>
        ))}
      </div>

      <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-3 border-t border-white/10 px-4 pb-8 pt-5 text-[13px] text-white/60 sm:px-6 lg:px-10">
        <p>© {new Date().getFullYear()} Beleqet. {t('footer.location')}</p>
        <div className="flex gap-5">
          <Link href="/privacy" className="text-white/75 hover:text-white">{t('footer.privacy')}</Link>
          <Link href="/contact" className="text-white/75 hover:text-white">{t('footer.contact')}</Link>
          <a href={TELEGRAM_URL} rel="noopener noreferrer" target="_blank" className="text-white/75 hover:text-white">Telegram</a>
        </div>
      </div>
    </footer>
  );
}
