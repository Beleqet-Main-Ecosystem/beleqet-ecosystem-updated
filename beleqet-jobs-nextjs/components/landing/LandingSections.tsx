'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, BarChart3, Bell, BriefcaseBusiness, Building2, Calculator, CalendarDays, Code2, FileScan,
  FileText, Globe, GraduationCap, HardHat, HeartPulse, LayoutGrid, Megaphone, MessageSquare,
  MessagesSquare, Mic, Palette, Play, Send, ShieldCheck, Sparkles, UserRound, Users, Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Category, Job } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { formatSalary, initials } from './format';

const TELEGRAM_CHANNEL = 'https://t.me/BeleqetJobs';
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_APP_URL;
const TELEGRAM_MINI_APP_URL = process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_URL;

/*
 * Each section follows two artboards: the base classes are the 390px mobile
 * design, `md:` and up is the desktop design.
 */
const wrap = 'mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10';
const sectionGap = 'pt-12 md:pt-24 lg:pt-28';
const eyebrow = 'text-xs font-bold uppercase tracking-[0.08em] text-forest md:text-[13px] dark:text-limeAccent';
const h2 = 'text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] text-ink-900 md:text-[clamp(28px,3.4vw,40px)] dark:text-white';
const lede = 'text-[15px] leading-relaxed text-ink-600 md:text-[17px] dark:text-slate-300';
const card = 'rounded-xl border border-ink-200 bg-surface dark:border-slate-800 dark:bg-slate-900';
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2';
const outlineButton = `flex min-h-12 items-center justify-center rounded-md border border-ink-300 bg-surface px-4 text-[15px] font-semibold text-ink-900 hover:border-ink-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`;

/* ─────────────────────────────── Trust strip ─────────────────────────────── */

export function TrustStrip() {
  const { t } = useTranslation();
  return (
    <section aria-label={t('landing.trust.label')} className="border-b border-ink-200 bg-surface dark:border-slate-800 dark:bg-slate-900">
      <div className={`${wrap} flex flex-col gap-3 py-[18px] text-sm text-ink-600 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-8 md:gap-y-4 md:py-5 dark:text-slate-300`}>
        <span className="inline-flex flex-wrap items-center gap-2 md:gap-2.5">
          <span className="font-semibold text-ink-900 dark:text-white">{t('landing.trust.payWith')}</span>
          {['Telebirr', 'CBE Birr', 'Chapa'].map((rail) => (
            <span key={rail} className="rounded-md border border-ink-200 px-2.5 py-1 font-semibold text-ink-900 dark:border-slate-700 dark:text-white">
              {rail}
            </span>
          ))}
        </span>
        <TrustItem icon={ShieldCheck} text={t('landing.trust.escrow')} />
        <TrustItem icon={Globe} text={t('landing.trust.languages')} className="hidden md:inline-flex" />
        <TrustItem icon={Send} text={t('landing.trust.telegram')} className="hidden md:inline-flex" />
      </div>
    </section>
  );
}

function TrustItem({ icon: Icon, text, className = 'inline-flex' }: { icon: LucideIcon; text: string; className?: string }) {
  return (
    <span className={`${className} items-center gap-2`}>
      <Icon className="h-[18px] w-[18px] text-forest dark:text-limeAccent" aria-hidden="true" />
      {text}
    </span>
  );
}

/* ─────────────────────────────── Latest jobs ─────────────────────────────── */

export function LatestJobs({ jobs }: { jobs: Job[] }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="latest-h" className={`${wrap} pt-12 md:pt-20 lg:pt-24`}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div className="flex flex-col gap-2 md:gap-2.5">
          <span className={eyebrow}>{t('landing.latest.eyebrow')}</span>
          <h2 id="latest-h" className={h2}>{t('landing.latest.title')}</h2>
        </div>
        <Link href="/jobs" className={`${outlineButton} hidden min-h-11 text-sm md:inline-flex`}>
          {t('landing.latest.browseAll')} →
        </Link>
      </div>

      {jobs.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 md:grid md:grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] md:gap-4">
            {jobs.map((job, i) => {
              const pay = formatSalary(job) ?? t('landing.salaryNotListed');
              return (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className={`${card} ${i >= 3 ? 'hidden md:flex' : 'flex'} flex-col gap-3.5 p-[18px] text-ink-900 transition-shadow hover:shadow-card-hover md:gap-4 md:p-[22px] dark:text-white ${focusRing}`}
                >
                  <span className="flex items-start gap-3 md:gap-3.5">
                    <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-md bg-primary text-[13px] font-bold text-limeAccent md:h-11 md:w-11 md:text-sm" aria-hidden="true">
                      {initials(job.company)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <b className="line-clamp-2 text-base font-bold tracking-[-0.01em] md:text-[17px]">{job.title}</b>
                      <span className="truncate text-sm text-ink-600 dark:text-slate-400">
                        {job.company}
                        <span className="md:hidden">{job.location ? ` · ${job.location}` : ''}</span>
                      </span>
                    </span>
                  </span>
                  <span className="hidden flex-wrap gap-1.5 md:flex">
                    {job.type && <span className="rounded-full bg-[#EEF5EF] px-2.5 py-1 text-xs font-semibold text-forest dark:bg-forest/20 dark:text-limeAccent">{job.type}</span>}
                    {job.location && <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700 dark:bg-slate-800 dark:text-slate-300">{job.location}</span>}
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-3 border-t border-ink-100 pt-3 md:pt-3.5 dark:border-slate-800">
                    <b className="text-sm font-bold md:text-[15px]">{pay}</b>
                    {job.type && <span className="rounded-full bg-[#EEF5EF] px-2.5 py-0.5 text-xs font-semibold text-forest md:hidden dark:bg-forest/20 dark:text-limeAccent">{job.type}</span>}
                    <span className="hidden shrink-0 text-[13px] text-ink-600 md:inline dark:text-slate-400">{job.postedAgo}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          <Link href="/jobs" className={`${outlineButton} mt-3.5 md:hidden`}>
            {t('landing.latest.browseAll')} →
          </Link>
        </>
      ) : (
        <div className={`${card} flex flex-col items-center gap-2 px-6 py-12 text-center`}>
          <b className="text-lg text-ink-900 dark:text-white">{t('landing.latest.emptyTitle')}</b>
          <p className="max-w-md text-[15px] text-ink-600 dark:text-slate-400">{t('landing.latest.emptyText')}</p>
          <a href={TELEGRAM_CHANNEL} rel="noopener noreferrer" target="_blank" className="mt-2 text-[15px] font-bold text-forest hover:underline dark:text-limeAccent">
            {t('landing.latest.emptyCta')} →
          </a>
        </div>
      )}
    </section>
  );
}

/* ─────────────────────────────── Why Beleqet ─────────────────────────────── */

const WHY: { key: string; icon: LucideIcon }[] = [
  { key: 'trust', icon: ShieldCheck },
  { key: 'profile', icon: UserRound },
  { key: 'alerts', icon: Bell },
  { key: 'local', icon: Globe },
];

export function WhyBeleqet() {
  const { t } = useTranslation();
  const cta = `min-h-12 items-center justify-center rounded-md bg-primary px-5 text-[15px] font-bold text-white hover:bg-primary2 dark:bg-limeAccent dark:text-obsidian ${focusRing}`;
  return (
    <section aria-labelledby="why-h" className={`${wrap} ${sectionGap}`}>
      <div className="grid grid-cols-1 items-start gap-2 md:gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-2.5 md:gap-4">
          <span className={eyebrow}>{t('landing.why.eyebrow')}</span>
          <h2 id="why-h" className="text-[32px] font-extrabold leading-[1.04] tracking-[-0.045em] text-obsidian md:text-[clamp(34px,4.4vw,56px)] md:leading-[1.02] dark:text-white">
            {t('landing.why.titleA')}
            <br />
            {t('landing.why.titleB')}
          </h2>
          <p className={`${lede} max-w-[440px]`}>{t('landing.why.sub')}</p>
          <Link href="/register" className={`${cta} mt-2 hidden self-start md:inline-flex`}>
            {t('landing.why.cta')}
          </Link>
        </div>
        <ul className="flex flex-col">
          {WHY.map((item, i) => (
            <li key={item.key} className="flex items-start gap-5 border-t border-[#DDE3E0] py-4 md:py-6 dark:border-slate-800">
              <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-xl border border-ink-200 bg-surface text-forest md:grid dark:border-slate-700 dark:bg-slate-900 dark:text-limeAccent">
                <item.icon className="h-[22px] w-[22px]" aria-hidden="true" />
              </span>
              <span className="flex flex-1 flex-col gap-1 md:gap-1.5">
                <b className="text-base font-bold tracking-[-0.01em] text-ink-900 md:text-lg dark:text-white">{t(`landing.why.${item.key}.title`)}</b>
                <span className="text-sm leading-relaxed text-ink-600 md:text-[15px] dark:text-slate-400">{t(`landing.why.${item.key}.text`)}</span>
              </span>
              <span aria-hidden="true" className="hidden text-[32px] font-extrabold leading-none text-[#DDE3E0] md:block dark:text-slate-700">
                {String(i + 1).padStart(2, '0')}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/register" className={`${cta} flex md:hidden`}>
          {t('landing.why.cta')}
        </Link>
      </div>
    </section>
  );
}

/* ─────────────────────────────── How it works (desktop only) ─────────────────────────────── */

const PATHS = [
  { key: 'seekers', href: '/jobs' },
  { key: 'employers', href: '/post-job' },
  { key: 'clients', href: '/post-job?type=freelance' },
];

export function HowItWorks() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="how-h" className={`${wrap} ${sectionGap} hidden md:block`}>
      <div className="mb-10 flex max-w-[640px] flex-col gap-3">
        <span className={eyebrow}>{t('landing.how.eyebrow')}</span>
        <h2 id="how-h" className={h2}>{t('landing.how.title')}</h2>
        <p className={lede}>{t('landing.how.sub')}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
        {PATHS.map((path) => (
          <div key={path.key} className={`${card} flex flex-col gap-[22px] p-7`}>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-600 dark:text-slate-400">{t(`landing.how.${path.key}.who`)}</span>
              <h3 className="text-[21px] font-bold tracking-[-0.02em] text-ink-900 dark:text-white">{t(`landing.how.${path.key}.title`)}</h3>
            </div>
            <ol className="flex flex-col gap-3.5">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex items-start gap-3 text-[15px] leading-normal text-ink-700 dark:text-slate-300">
                  <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-limeAccent" aria-hidden="true">
                    {n}
                  </span>
                  <span className="pt-0.5">{t(`landing.how.${path.key}.step${n}`)}</span>
                </li>
              ))}
            </ol>
            <Link href={path.href} className={`mt-auto inline-flex min-h-11 items-center self-start rounded text-[15px] font-bold text-forest hover:underline dark:text-limeAccent ${focusRing}`}>
              {t(`landing.how.${path.key}.cta`)} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────── Escrow ─────────────────────────────── */

export function EscrowSection() {
  const { t } = useTranslation();
  return (
    <section id="escrow" aria-labelledby="safe-h" className={`px-4 sm:px-6 lg:px-10 ${sectionGap}`}>
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-[18px] rounded-2xl bg-primary px-5 py-6 text-white md:gap-12 md:rounded-[20px] md:p-10 lg:grid-cols-2 lg:p-16">
        <div className="flex min-w-0 flex-col gap-[18px] md:gap-[22px]">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-limeAccent px-3 py-1.5 text-xs font-bold text-obsidian md:text-[13px]">
            <ShieldCheck className="hidden h-3.5 w-3.5 md:block" aria-hidden="true" />
            {t('landing.escrow.badge')}
          </span>
          <h2 id="safe-h" className="text-[28px] font-extrabold leading-[1.12] tracking-[-0.035em] md:text-[clamp(30px,3.8vw,46px)] md:leading-[1.1]">{t('landing.escrow.title')}</h2>
          <p className="hidden text-[17px] leading-relaxed text-white/75 md:block">{t('landing.escrow.sub')}</p>
          <ol className="flex flex-col gap-2.5 md:mt-2 md:grid md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] md:gap-3">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="flex gap-3 rounded-xl border border-white/[0.12] p-3.5 md:flex-col md:gap-2 md:p-4">
                <span className="shrink-0 pt-0.5 text-xs font-bold text-limeAccent md:pt-0">{String(n).padStart(2, '0')}</span>
                <span className="flex flex-col gap-1 md:contents">
                  <b className="text-[15px] font-bold">{t(`landing.escrow.step${n}.title`)}</b>
                  <span className="text-[13px] leading-normal text-white/65">{t(`landing.escrow.step${n}.text`)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="min-w-0 self-start rounded-xl bg-surface px-4 py-1 text-ink-900 md:rounded-2xl md:p-7">
          <h3 className="mb-1.5 hidden text-[19px] font-bold tracking-[-0.01em] md:block">{t('landing.escrow.termsTitle')}</h3>
          <p className="mb-[18px] hidden text-sm text-ink-600 md:block">{t('landing.escrow.termsSub')}</p>
          <dl className="flex flex-col">
            {['fee', 'client', 'timing', 'disputes'].map((key, i) => (
              <div
                key={key}
                className={`flex flex-col gap-[3px] py-3 md:flex-row md:flex-wrap md:justify-between md:gap-x-6 md:gap-y-1.5 md:border-t md:py-3.5 ${
                  i < 3 ? 'border-b border-ink-200 md:border-b-0' : ''
                } md:border-ink-200`}
              >
                <dt className="text-[13px] font-bold md:text-sm md:font-semibold">{t(`landing.escrow.terms.${key}.k`)}</dt>
                <dd className="text-[13px] leading-normal text-ink-700 md:flex-[1_1_220px] md:text-right md:text-sm">{t(`landing.escrow.terms.${key}.v`)}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/post-job?type=freelance"
            className={`mt-[18px] hidden min-h-12 items-center justify-center rounded-md bg-primary text-[15px] font-bold text-limeAccent hover:bg-primary2 md:flex ${focusRing}`}
          >
            {t('landing.escrow.cta')}
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Categories ─────────────────────────────── */

/** Fields shown on the landing page, in order, when the API has them. */
const FEATURED_CATEGORIES: { slug: string; icon: LucideIcon }[] = [
  { slug: 'accounting-and-finance', icon: BarChart3 },
  { slug: 'software-design-and-development', icon: Code2 },
  { slug: 'sales-and-promotion', icon: Megaphone },
  { slug: 'creative-art-and-design', icon: Palette },
  { slug: 'human-resource-and-talent-management', icon: Users },
  { slug: 'construction-and-civil-engineering', icon: HardHat },
  { slug: 'health-care', icon: HeartPulse },
  { slug: 'teaching-and-tutor', icon: GraduationCap },
];

export function CategoryLinks({ categories }: { categories: Category[] }) {
  const { t } = useTranslation();
  const byId = new Map(categories.map((c) => [c.id, c]));
  const featured = FEATURED_CATEGORIES.filter((f) => byId.has(f.slug)).map((f) => ({ ...byId.get(f.slug)!, Icon: f.icon }));
  const shown = featured.length >= 4 ? featured : categories.slice(0, 8).map((c) => ({ ...c, Icon: BriefcaseBusiness }));
  if (shown.length === 0) return null;

  // Prefer a translated label; fall back to the API's English label.
  const label = (c: Category) => {
    const key = `landing.categories.${c.id}`;
    const translated = t(key);
    return translated === key ? c.label : translated;
  };

  return (
    <section aria-labelledby="cat-h" className={`${wrap} ${sectionGap}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <div className="flex flex-col gap-2.5">
          <span className={`${eyebrow} hidden md:block`}>{t('landing.categories.eyebrow')}</span>
          <h2 id="cat-h" className={`${h2} text-2xl md:text-[clamp(28px,3.4vw,40px)]`}>{t('landing.categories.title')}</h2>
        </div>
        <Link href="/jobs" className="hidden text-sm font-bold text-forest hover:underline md:inline dark:text-limeAccent">
          {t('landing.categories.all').replace('{count}', String(categories.length))} →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] md:gap-3">
        {shown.map((c) => (
          <Link
            key={c.id}
            href={`/jobs?category=${encodeURIComponent(c.id)}`}
            className={`${card} flex min-h-24 flex-col gap-2.5 p-3.5 text-ink-900 transition-colors hover:border-forest/40 md:min-h-[72px] md:flex-row md:items-center md:gap-3.5 md:px-[18px] md:py-0 dark:text-white ${focusRing}`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#EEF5EF] text-forest md:h-10 md:w-10 dark:bg-forest/20 dark:text-limeAccent">
              <c.Icon className="h-[18px] w-[18px] md:h-5 md:w-5" aria-hidden="true" />
            </span>
            <b className="flex-1 text-sm font-semibold leading-tight md:text-[15px]">{label(c)}</b>
            <ArrowRight className="hidden h-4 w-4 text-ink-500 md:block" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────── Feature tabs ─────────────────────────────── */

type Feature = { key: string; icon: LucideIcon; href: string };

const FEATURES: Record<string, Feature[]> = {
  seekers: [
    { key: 'feed', icon: Sparkles, href: '/feed' },
    { key: 'resumeBrain', icon: FileScan, href: '/resume-brain' },
    { key: 'cvMaker', icon: FileText, href: '/cv-maker' },
    { key: 'tracker', icon: LayoutGrid, href: '/applications' },
    { key: 'interviews', icon: CalendarDays, href: '/dashboard' },
    { key: 'alerts', icon: Send, href: TELEGRAM_CHANNEL },
  ],
  employers: [
    { key: 'postJobs', icon: BriefcaseBusiness, href: '/post-job' },
    { key: 'applicants', icon: Users, href: '/employer' },
    { key: 'messaging', icon: MessageSquare, href: '/messages' },
    { key: 'plans', icon: Building2, href: '/pricing' },
  ],
  freelance: [
    { key: 'bids', icon: Megaphone, href: '/freelance' },
    { key: 'escrow', icon: ShieldCheck, href: '/#escrow' },
    { key: 'workspace', icon: LayoutGrid, href: '/freelance' },
    { key: 'wallet', icon: Wallet, href: '/dashboard' },
  ],
  tools: [
    { key: 'forum', icon: MessagesSquare, href: '/forum' },
    { key: 'voice', icon: Mic, href: '/chat-to-text' },
    { key: 'tax', icon: Calculator, href: '/tax-calculator' },
  ],
};

export function FeatureTabs() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<keyof typeof FEATURES>('seekers');
  return (
    <section aria-labelledby="feat-h" className={`${wrap} ${sectionGap}`}>
      <div className="mb-3 flex flex-col gap-4 md:mb-7 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-5">
        <div className="flex max-w-[600px] flex-col gap-2 md:gap-3">
          <span className={eyebrow}>{t('landing.features.eyebrow')}</span>
          <h2 id="feat-h" className={`${h2} text-[26px] md:text-[clamp(28px,3.4vw,40px)]`}>{t('landing.features.title')}</h2>
          <p className={`${lede} hidden md:block`}>{t('landing.features.sub')}</p>
        </div>
        <div
          role="group"
          aria-label={t('landing.features.groupLabel')}
          className="grid grid-cols-4 gap-0.5 rounded-[10px] border border-ink-200 bg-surface p-1 md:flex md:flex-wrap md:gap-1 dark:border-slate-700 dark:bg-slate-900"
        >
          {(Object.keys(FEATURES) as (keyof typeof FEATURES)[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-10 rounded-[7px] px-1 text-xs leading-tight transition-colors md:px-3.5 md:text-sm ${focusRing} ${
                tab === id ? 'bg-primary font-bold text-white dark:bg-limeAccent dark:text-obsidian' : 'font-semibold text-ink-700 hover:bg-ink-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {t(`landing.features.tabs.${id}`)}
            </button>
          ))}
        </div>
      </div>
      <div className={`${card} px-4 md:grid md:grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] md:gap-4 md:border-0 md:bg-transparent md:px-0 md:dark:bg-transparent`}>
        {FEATURES[tab].map((f) => {
          const external = f.href.startsWith('http');
          return (
            <Link
              key={f.key}
              href={f.href}
              {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
              className={`flex min-h-16 items-center gap-3 border-b border-ink-100 py-3 text-ink-900 last:border-b-0 md:items-start md:gap-4 md:rounded-xl md:border md:border-ink-200 md:bg-surface md:p-[22px] md:transition-shadow md:last:border-b md:hover:shadow-card-hover dark:border-slate-800 dark:text-white md:dark:bg-slate-900 ${focusRing}`}
            >
              <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-primary text-limeAccent md:grid">
                <f.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex flex-1 flex-col gap-[3px] md:gap-1.5">
                <b className="text-[15px] font-bold md:text-base">{t(`landing.features.items.${f.key}.name`)}</b>
                <span className="text-[13px] leading-snug text-ink-600 md:text-sm md:leading-relaxed dark:text-slate-400">{t(`landing.features.items.${f.key}.text`)}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-500 md:hidden" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ─────────────────────────────── App + Telegram ─────────────────────────────── */

export function AppAndTelegram() {
  const { t } = useTranslation();
  const solo = !ANDROID_URL;
  return (
    <section aria-label={t('landing.channels.label')} className={`${wrap} ${sectionGap}`}>
      <div className={`grid grid-cols-1 gap-3 md:gap-4 ${solo ? '' : 'lg:grid-cols-2'}`}>
        {ANDROID_URL && (
          <div className="flex flex-col gap-2.5 rounded-2xl bg-primary2 px-5 py-[22px] text-white md:gap-3.5 md:p-10">
            <span className="hidden h-11 w-11 place-items-center rounded-[10px] bg-limeAccent text-obsidian md:grid">
              <Play className="h-[22px] w-[22px]" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-extrabold tracking-[-0.02em] md:text-[26px] md:tracking-[-0.03em]">{t('landing.channels.androidTitle')}</h2>
            <p className="text-sm leading-relaxed text-white/75 md:text-[15px]">{t('landing.channels.androidText')}</p>
            <a
              href={ANDROID_URL}
              rel="noopener noreferrer"
              target="_blank"
              className="mt-1 flex min-h-12 items-center justify-center gap-2.5 rounded-md bg-surface px-[18px] text-[15px] font-bold text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limeAccent md:mt-1.5 md:inline-flex md:self-start"
            >
              <Play className="hidden h-[18px] w-[18px] md:block" aria-hidden="true" />
              {t('landing.channels.androidCta')}
            </a>
          </div>
        )}
        {/* On its own the Telegram card lays out in a row so it doesn't leave a wide empty box. */}
        <div className={`${card} flex flex-col gap-2.5 rounded-2xl px-5 py-[22px] md:gap-3.5 md:p-10 ${solo ? 'md:flex-row md:items-center md:justify-between md:gap-10' : ''}`}>
          <div className="flex flex-col gap-2.5 md:gap-3.5">
            <span className="hidden h-11 w-11 place-items-center rounded-[10px] bg-[#EEF5EF] text-forest md:grid dark:bg-forest/20 dark:text-limeAccent">
              <Send className="h-[22px] w-[22px]" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-[26px] md:tracking-[-0.03em] dark:text-white">{t('landing.channels.telegramTitle')}</h2>
            <p className="max-w-xl text-sm leading-relaxed text-ink-600 md:text-[15px] dark:text-slate-400">
              {t(TELEGRAM_MINI_APP_URL ? 'landing.channels.telegramTextMiniApp' : 'landing.channels.telegramText')}
            </p>
          </div>
          <span className="mt-1 flex shrink-0 flex-col gap-2.5 md:mt-1.5 md:flex-row md:flex-wrap">
            <a
              href={TELEGRAM_CHANNEL}
              rel="noopener noreferrer"
              target="_blank"
              className={`flex min-h-12 items-center justify-center rounded-md bg-primary px-[18px] text-[15px] font-bold text-white dark:bg-limeAccent dark:text-obsidian ${focusRing}`}
            >
              {t('landing.channels.joinChannel')}
            </a>
            {TELEGRAM_MINI_APP_URL && (
              <a
                href={TELEGRAM_MINI_APP_URL}
                rel="noopener noreferrer"
                target="_blank"
                className={`flex min-h-12 items-center justify-center rounded-md border border-ink-300 px-[18px] text-[15px] font-bold text-ink-900 dark:border-slate-700 dark:text-white ${focusRing}`}
              >
                {t('landing.channels.openMiniApp')}
              </a>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── CTA band ─────────────────────────────── */

export function CtaBand() {
  const { t } = useTranslation();
  const ring = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-limeAccent';
  return (
    <section aria-labelledby="cta-h" className="px-4 py-12 sm:px-6 md:py-24 lg:px-10 lg:py-28">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3.5 rounded-2xl bg-limeAccent px-5 py-[26px] text-obsidian md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-7 md:rounded-[20px] md:p-14">
        <div className="flex flex-col gap-2.5 md:flex-[1_1_420px]">
          <h2 id="cta-h" className="text-[26px] font-extrabold leading-[1.12] tracking-[-0.035em] md:text-[clamp(28px,3.6vw,42px)] md:leading-[1.1]">{t('landing.cta.title')}</h2>
          <p className="hidden text-[17px] leading-relaxed text-[#1B3A12] md:block">{t('landing.cta.sub')}</p>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
          <Link href="/jobs" className={`flex min-h-[50px] items-center justify-center rounded-md bg-primary px-6 text-base font-bold text-limeAccent md:min-h-[52px] ${ring}`}>
            {t('landing.cta.findJobs')}
          </Link>
          <Link href="/post-job" className={`flex min-h-[50px] items-center justify-center rounded-md border-2 border-primary px-6 text-base font-bold text-obsidian md:min-h-[52px] ${ring}`}>
            {t('landing.cta.postJob')}
          </Link>
        </div>
      </div>
    </section>
  );
}
