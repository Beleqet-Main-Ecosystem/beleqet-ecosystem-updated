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

const wrap = 'mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10';
const sectionGap = 'pt-16 sm:pt-24 lg:pt-28';
const eyebrow = 'text-[13px] font-bold uppercase tracking-[0.08em] text-brandGreen dark:text-limeAccent';
const h2 = 'text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.15] tracking-[-0.03em] text-ink dark:text-white';
const lede = 'text-[17px] leading-relaxed text-muted dark:text-slate-300';
const card = 'rounded-xl border border-border bg-white dark:border-slate-800 dark:bg-slate-900';
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandGreen focus-visible:ring-offset-2';

/* ─────────────────────────────── Trust strip ─────────────────────────────── */

export function TrustStrip() {
  const { t } = useTranslation();
  return (
    <section aria-label={t('landing.trust.label')} className="border-b border-border bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className={`${wrap} flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-5 text-sm text-muted dark:text-slate-300`}>
        <span className="inline-flex flex-wrap items-center gap-2.5">
          <span className="font-semibold text-ink dark:text-white">{t('landing.trust.payWith')}</span>
          {['Telebirr', 'CBE Birr', 'Chapa'].map((rail) => (
            <span key={rail} className="rounded-md border border-border px-2.5 py-1 font-semibold text-ink dark:border-slate-700 dark:text-white">
              {rail}
            </span>
          ))}
        </span>
        <TrustItem icon={ShieldCheck} text={t('landing.trust.escrow')} />
        <TrustItem icon={Globe} text={t('landing.trust.languages')} />
        <TrustItem icon={Send} text={t('landing.trust.telegram')} />
      </div>
    </section>
  );
}

function TrustItem({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="h-[18px] w-[18px] text-brandGreen dark:text-limeAccent" aria-hidden="true" />
      {text}
    </span>
  );
}

/* ─────────────────────────────── Latest jobs ─────────────────────────────── */

export function LatestJobs({ jobs }: { jobs: Job[] }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="latest-h" className={`${wrap} pt-14 sm:pt-20 lg:pt-24`}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className={eyebrow}>{t('landing.latest.eyebrow')}</span>
          <h2 id="latest-h" className={h2}>{t('landing.latest.title')}</h2>
        </div>
        <Link
          href="/jobs"
          className={`inline-flex min-h-11 items-center rounded-md border border-ink-300 bg-white px-4 text-sm font-semibold text-ink hover:border-ink-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white ${focusRing}`}
        >
          {t('landing.latest.browseAll')} →
        </Link>
      </div>

      {jobs.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className={`${card} flex flex-col gap-4 p-[22px] text-ink transition-shadow hover:shadow-card-hover dark:text-white ${focusRing}`}
            >
              <span className="flex items-start gap-3.5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-limeAccent" aria-hidden="true">
                  {initials(job.company)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <b className="line-clamp-2 text-[17px] font-bold tracking-[-0.01em]">{job.title}</b>
                  <span className="truncate text-sm text-muted dark:text-slate-400">{job.company}</span>
                </span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {job.type && <span className="rounded-full bg-[#EEF5EF] px-2.5 py-1 text-xs font-semibold text-brandGreen dark:bg-brandGreen/20 dark:text-limeAccent">{job.type}</span>}
                {job.location && <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700 dark:bg-slate-800 dark:text-slate-300">{job.location}</span>}
              </span>
              <span className="mt-auto flex items-center justify-between gap-3 border-t border-ink-100 pt-3.5 dark:border-slate-800">
                <b className="text-[15px] font-bold">{formatSalary(job) ?? t('landing.salaryNotListed')}</b>
                <span className="shrink-0 text-[13px] text-muted dark:text-slate-400">{job.postedAgo}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className={`${card} flex flex-col items-center gap-2 px-6 py-12 text-center`}>
          <b className="text-lg text-ink dark:text-white">{t('landing.latest.emptyTitle')}</b>
          <p className="max-w-md text-[15px] text-muted dark:text-slate-400">{t('landing.latest.emptyText')}</p>
          <a href={TELEGRAM_CHANNEL} rel="noopener noreferrer" target="_blank" className="mt-2 text-[15px] font-bold text-brandGreen hover:underline dark:text-limeAccent">
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
  return (
    <section aria-labelledby="why-h" className={`${wrap} ${sectionGap}`}>
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className={eyebrow}>{t('landing.why.eyebrow')}</span>
          <h2 id="why-h" className="text-[clamp(34px,4.4vw,56px)] font-extrabold leading-[1.02] tracking-[-0.045em] text-primary dark:text-white">
            {t('landing.why.titleA')}
            <br />
            {t('landing.why.titleB')}
          </h2>
          <p className={`${lede} max-w-[440px]`}>{t('landing.why.sub')}</p>
          <Link
            href="/register"
            className={`mt-2 inline-flex min-h-12 items-center self-start rounded-md bg-primary px-5 text-[15px] font-bold text-white hover:bg-primary2 dark:bg-limeAccent dark:text-primary ${focusRing}`}
          >
            {t('landing.why.cta')}
          </Link>
        </div>
        <ul className="flex flex-col">
          {WHY.map((item, i) => (
            <li key={item.key} className="flex items-start gap-5 border-t border-[#DDE3E0] py-6 dark:border-slate-800">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-border bg-white text-brandGreen dark:border-slate-700 dark:bg-slate-900 dark:text-limeAccent">
                <item.icon className="h-[22px] w-[22px]" aria-hidden="true" />
              </span>
              <span className="flex flex-1 flex-col gap-1.5">
                <b className="text-lg font-bold tracking-[-0.01em] text-ink dark:text-white">{t(`landing.why.${item.key}.title`)}</b>
                <span className="text-[15px] leading-relaxed text-muted dark:text-slate-400">{t(`landing.why.${item.key}.text`)}</span>
              </span>
              <span aria-hidden="true" className="text-[32px] font-extrabold leading-none text-[#DDE3E0] dark:text-slate-700">
                {String(i + 1).padStart(2, '0')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────────── How it works ─────────────────────────────── */

const PATHS = [
  { key: 'seekers', href: '/jobs' },
  { key: 'employers', href: '/post-job' },
  { key: 'clients', href: '/post-job?type=freelance' },
];

export function HowItWorks() {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="how-h" className={`${wrap} ${sectionGap}`}>
      <div className="mb-10 flex max-w-[640px] flex-col gap-3">
        <span className={eyebrow}>{t('landing.how.eyebrow')}</span>
        <h2 id="how-h" className={h2}>{t('landing.how.title')}</h2>
        <p className={lede}>{t('landing.how.sub')}</p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
        {PATHS.map((path) => (
          <div key={path.key} className={`${card} flex flex-col gap-[22px] p-7`}>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-muted dark:text-slate-400">{t(`landing.how.${path.key}.who`)}</span>
              <h3 className="text-[21px] font-bold tracking-[-0.02em] text-ink dark:text-white">{t(`landing.how.${path.key}.title`)}</h3>
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
            <Link href={path.href} className={`mt-auto inline-flex min-h-11 items-center self-start rounded text-[15px] font-bold text-brandGreen hover:underline dark:text-limeAccent ${focusRing}`}>
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
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 rounded-[20px] bg-primary p-7 text-white sm:p-10 lg:grid-cols-2 lg:p-16">
        <div className="flex min-w-0 flex-col gap-[22px]">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-limeAccent px-3 py-1.5 text-[13px] font-bold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('landing.escrow.badge')}
          </span>
          <h2 id="safe-h" className="text-[clamp(30px,3.8vw,46px)] font-extrabold leading-[1.1] tracking-[-0.035em]">{t('landing.escrow.title')}</h2>
          <p className="text-[17px] leading-relaxed text-white/75">{t('landing.escrow.sub')}</p>
          <ol className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className="flex flex-col gap-2 rounded-xl border border-white/[0.12] p-4">
                <span className="text-xs font-bold text-limeAccent">{String(n).padStart(2, '0')}</span>
                <b className="text-[15px] font-bold">{t(`landing.escrow.step${n}.title`)}</b>
                <span className="text-[13px] leading-normal text-white/65">{t(`landing.escrow.step${n}.text`)}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="min-w-0 self-start rounded-2xl bg-white p-7 text-ink">
          <h3 className="mb-1.5 text-[19px] font-bold tracking-[-0.01em]">{t('landing.escrow.termsTitle')}</h3>
          <p className="mb-[18px] text-sm text-muted">{t('landing.escrow.termsSub')}</p>
          <dl className="flex flex-col">
            {['fee', 'client', 'timing', 'disputes'].map((key) => (
              <div key={key} className="flex flex-wrap justify-between gap-x-6 gap-y-1.5 border-t border-border py-3.5">
                <dt className="text-sm font-semibold">{t(`landing.escrow.terms.${key}.k`)}</dt>
                <dd className="flex-[1_1_220px] text-right text-sm leading-normal text-ink-700">{t(`landing.escrow.terms.${key}.v`)}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/post-job?type=freelance"
            className={`mt-[18px] flex min-h-12 items-center justify-center rounded-md bg-primary text-[15px] font-bold text-limeAccent hover:bg-primary2 ${focusRing}`}
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
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className={eyebrow}>{t('landing.categories.eyebrow')}</span>
          <h2 id="cat-h" className={h2}>{t('landing.categories.title')}</h2>
        </div>
        <Link href="/jobs" className="text-sm font-bold text-brandGreen hover:underline dark:text-limeAccent">
          {t('landing.categories.all').replace('{count}', String(categories.length))} →
        </Link>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,250px),1fr))] gap-3">
        {shown.map((c) => (
          <Link
            key={c.id}
            href={`/jobs?category=${encodeURIComponent(c.id)}`}
            className={`${card} flex min-h-[72px] items-center gap-3.5 px-[18px] text-ink transition-colors hover:border-brandGreen/40 dark:text-white ${focusRing}`}
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#EEF5EF] text-brandGreen dark:bg-brandGreen/20 dark:text-limeAccent">
              <c.Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <b className="flex-1 text-[15px] font-semibold">{label(c)}</b>
            <ArrowRight className="h-4 w-4 text-ink-500" aria-hidden="true" />
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
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div className="flex max-w-[600px] flex-col gap-3">
          <span className={eyebrow}>{t('landing.features.eyebrow')}</span>
          <h2 id="feat-h" className={h2}>{t('landing.features.title')}</h2>
          <p className={lede}>{t('landing.features.sub')}</p>
        </div>
        <div role="group" aria-label={t('landing.features.groupLabel')} className="flex flex-wrap gap-1 rounded-[10px] border border-border bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          {(Object.keys(FEATURES) as (keyof typeof FEATURES)[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-10 rounded-[7px] px-3.5 text-sm transition-colors ${focusRing} ${
                tab === id ? 'bg-primary font-bold text-white dark:bg-limeAccent dark:text-primary' : 'font-semibold text-ink-700 hover:bg-ink-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {t(`landing.features.tabs.${id}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
        {FEATURES[tab].map((f) => {
          const external = f.href.startsWith('http');
          return (
            <Link
              key={f.key}
              href={f.href}
              {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
              className={`${card} flex items-start gap-4 p-[22px] text-ink transition-shadow hover:shadow-card-hover dark:text-white ${focusRing}`}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-primary text-limeAccent">
                <f.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-1.5">
                <b className="text-base font-bold">{t(`landing.features.items.${f.key}.name`)}</b>
                <span className="text-sm leading-relaxed text-muted dark:text-slate-400">{t(`landing.features.items.${f.key}.text`)}</span>
              </span>
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
  return (
    <section aria-label={t('landing.channels.label')} className={`${wrap} ${sectionGap}`}>
      <div className={`grid grid-cols-1 gap-4 ${ANDROID_URL ? 'lg:grid-cols-2' : ''}`}>
        {ANDROID_URL && (
          <div className="flex flex-col gap-3.5 rounded-2xl bg-primary2 p-6 text-white sm:p-10">
            <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-limeAccent text-primary">
              <Play className="h-[22px] w-[22px]" aria-hidden="true" />
            </span>
            <h2 className="text-[26px] font-extrabold tracking-[-0.03em]">{t('landing.channels.androidTitle')}</h2>
            <p className="text-[15px] leading-relaxed text-white/75">{t('landing.channels.androidText')}</p>
            <a
              href={ANDROID_URL}
              rel="noopener noreferrer"
              target="_blank"
              className="mt-1.5 inline-flex min-h-12 items-center gap-2.5 self-start rounded-md bg-white px-[18px] text-[15px] font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limeAccent"
            >
              <Play className="h-[18px] w-[18px]" aria-hidden="true" />
              {t('landing.channels.androidCta')}
            </a>
          </div>
        )}
        <div className={`${card} flex flex-col gap-3.5 rounded-2xl p-6 sm:p-10`}>
          <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-[#EEF5EF] text-brandGreen dark:bg-brandGreen/20 dark:text-limeAccent">
            <Send className="h-[22px] w-[22px]" aria-hidden="true" />
          </span>
          <h2 className="text-[26px] font-extrabold tracking-[-0.03em] text-ink dark:text-white">{t('landing.channels.telegramTitle')}</h2>
          <p className="text-[15px] leading-relaxed text-muted dark:text-slate-400">
            {t(TELEGRAM_MINI_APP_URL ? 'landing.channels.telegramTextMiniApp' : 'landing.channels.telegramText')}
          </p>
          <span className="mt-1.5 flex flex-wrap gap-2.5">
            <a
              href={TELEGRAM_CHANNEL}
              rel="noopener noreferrer"
              target="_blank"
              className={`inline-flex min-h-12 items-center rounded-md bg-primary px-[18px] text-[15px] font-bold text-white dark:bg-limeAccent dark:text-primary ${focusRing}`}
            >
              {t('landing.channels.joinChannel')}
            </a>
            {TELEGRAM_MINI_APP_URL && (
              <a
                href={TELEGRAM_MINI_APP_URL}
                rel="noopener noreferrer"
                target="_blank"
                className={`inline-flex min-h-12 items-center rounded-md border border-ink-300 px-[18px] text-[15px] font-bold text-ink dark:border-slate-700 dark:text-white ${focusRing}`}
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
  return (
    <section aria-labelledby="cta-h" className="px-4 py-16 sm:px-6 sm:py-24 lg:px-10 lg:py-28">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-7 rounded-[20px] bg-limeAccent p-8 text-primary sm:p-14">
        <div className="flex flex-[1_1_420px] flex-col gap-2.5">
          <h2 id="cta-h" className="text-[clamp(28px,3.6vw,42px)] font-extrabold leading-[1.1] tracking-[-0.035em]">{t('landing.cta.title')}</h2>
          <p className="text-[17px] leading-relaxed text-[#1B3A12]">{t('landing.cta.sub')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/jobs" className="inline-flex min-h-[52px] items-center rounded-md bg-primary px-6 text-base font-bold text-limeAccent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-limeAccent">
            {t('landing.cta.findJobs')}
          </Link>
          <Link href="/post-job" className="inline-flex min-h-[52px] items-center rounded-md border-2 border-primary px-6 text-base font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-limeAccent">
            {t('landing.cta.postJob')}
          </Link>
        </div>
      </div>
    </section>
  );
}
