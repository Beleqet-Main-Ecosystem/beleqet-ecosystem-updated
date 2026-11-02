'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink, Mail, Share2, ShieldCheck } from 'lucide-react';
import SaveJobButton from '@/components/SaveJobButton';
import { useAuth } from '@/components/AuthProvider';
import { authenticatedFetch } from '@/lib/auth';
import type { Job } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { categoryLabel } from '../categories';
import type { DescriptionBlock } from '../description';
import { daysUntil, formatSalary, initials, postedAgo, safeEmail, safeHttpUrl } from '../format';
import ApplyDialog from './ApplyDialog';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
const wrap = 'mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-10';
const card = 'rounded-xl border border-ink-200 bg-surface dark:border-slate-800 dark:bg-slate-900';
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2';

type Props = {
  job: Job;
  description: DescriptionBlock[];
  requirements: DescriptionBlock[];
  similar: Job[];
};

export default function JobDetail({ job, description, requirements, similar }: Props) {
  const { t, locale } = useTranslation();
  const { user, ready } = useAuth();
  const router = useRouter();
  const [applyOpen, setApplyOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const [shareNote, setShareNote] = useState('');

  // Show "Applied" for people who already applied (Beleqet applications only).
  useEffect(() => {
    if (!user || job.applyMethod !== 'internal') return;
    authenticatedFetch(`${API_URL}/applications/my`)
      .then(async (res) => (res.ok ? res.json() : []))
      .then((apps: Array<{ jobId?: string; job?: { id?: string } }>) => {
        if (Array.isArray(apps) && apps.some((a) => (a.jobId ?? a.job?.id) === job.id)) setApplied(true);
      })
      .catch(() => undefined);
  }, [user, job.id, job.applyMethod]);

  const days = daysUntil(job.closesAt);
  const closed = days !== null && days < 0;
  const closesOn = job.closesAt
    ? new Date(job.closesAt).toLocaleDateString(locale === 'am' ? 'am-ET' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const externalUrl = job.applyMethod === 'external' ? safeHttpUrl(job.applyUrl) : null;
  const email = job.applyMethod === 'email' ? safeEmail(job.applyEmail) : null;
  const pay = formatSalary(job, t('search.upTo'));
  const monthly = !job.salaryType || job.salaryType.toLowerCase() === 'monthly';
  const typeLabel = job.typeCode ? t(`search.types.${job.typeCode}`) : job.type;
  const category = job.category ? { id: job.category, label: job.categoryLabel || job.category, icon: '' } : null;
  const website = safeHttpUrl(job.companyWebsite);

  function startApply() {
    if (!ready) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/jobs/${job.id}`)}`);
      return;
    }
    setApplyOpen(true);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: job.title, text: `${job.title} · ${job.company}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote(t('job.linkCopied'));
      setTimeout(() => setShareNote(''), 2500);
    } catch {
      // Cancelled share sheets throw; nothing to report.
    }
  }

  /** The apply control for this job's method, in a given visual style. */
  const applyControl = (tone: 'lime' | 'dark') => {
    const base = `inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-6 text-base font-extrabold ${focusRing}`;
    const style = tone === 'lime' ? 'bg-limeAccent text-obsidian hover:bg-[#c8ef2e]' : 'bg-primary text-limeAccent hover:bg-primary2 dark:bg-limeAccent dark:text-obsidian dark:hover:bg-[#c8ef2e]';
    if (closed) return null;
    if (externalUrl) {
      return (
        <a href={externalUrl} target="_blank" rel="noopener noreferrer nofollow" className={`${base} ${style}`}>
          {t('job.applyExternal')}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      );
    }
    if (email) {
      return (
        <a href={`mailto:${email}?subject=${encodeURIComponent(`${t('job.emailSubject')}: ${job.title}`)}`} className={`${base} ${style}`}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          {t('job.applyEmail')}
        </a>
      );
    }
    if (applied) {
      return (
        <span className={`inline-flex min-h-12 items-center gap-2 rounded-md px-[18px] text-[15px] font-bold ${tone === 'lime' ? 'bg-limeAccent/15 text-limeAccent' : 'bg-[#EEF5EF] text-forest'}`}>
          <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
          {t('job.applied')}
        </span>
      );
    }
    return (
      <button type="button" onClick={startApply} disabled={!ready} className={`${base} ${style}`}>
        {t('job.applyNow')}
      </button>
    );
  };

  const meta = [
    job.location,
    typeLabel,
    `${t('job.posted')} ${postedAgo(job.createdAt, locale, job.postedAgo)}`,
    job.applicantCount ? `${job.applicantCount} ${t(job.applicantCount === 1 ? 'job.applicant' : 'job.applicants')}` : '',
  ].filter(Boolean);

  const overview = [
    { k: t('job.salary'), v: pay ? `${pay}${monthly ? ` ${t('search.perMonth')}` : ''}` : t('landing.salaryNotListed') },
    { k: t('search.jobType'), v: typeLabel },
    { k: t('job.experience'), v: job.experienceLevel },
    { k: t('job.openings'), v: job.vacancies ? String(job.vacancies) : '' },
    { k: t('search.category'), v: category ? categoryLabel(category, t) : '' },
    { k: t('search.location'), v: job.location },
  ].filter((row) => row.v);

  return (
    <>
      {/* ── Header band ── */}
      <section className="bg-primary text-white">
        <div className={`${wrap} flex flex-col gap-5 pb-7 pt-4 md:pb-9`}>
          <nav aria-label={t('search.breadcrumb')} className="hidden text-[13px] text-white/60 md:block">
            <Link href="/" className="text-white/75 hover:text-white">{t('nav.home')}</Link>
            {' / '}
            <Link href="/jobs" className="text-white/75 hover:text-white">{t('nav.findJobs')}</Link>
            {category && (
              <>
                {' / '}
                <Link href={`/jobs?category=${encodeURIComponent(category.id)}`} className="text-white/75 hover:text-white">{categoryLabel(category, t)}</Link>
              </>
            )}
            {' / '}
            <span aria-current="page">{job.title}</span>
          </nav>
          <div className="flex flex-wrap items-start gap-4 md:gap-5">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[14px] bg-[#123626] text-lg font-extrabold text-limeAccent md:h-[72px] md:w-[72px] md:text-[22px]" aria-hidden="true">
              {initials(job.company)}
            </span>
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
              {(job.featured || job.urgent) && (
                <div className="flex flex-wrap gap-2">
                  {job.featured && <span className="rounded-md bg-limeAccent px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-obsidian">{t('search.featured')}</span>}
                  {job.urgent && <span className="rounded-md bg-[#FFF1E6] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[#9A3412]">{t('search.urgent')}</span>}
                </div>
              )}
              <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-[-0.03em] md:text-[clamp(28px,3.4vw,40px)]">{job.title}</h1>
              <span className="inline-flex flex-wrap items-center gap-2 text-base text-white/85">
                {job.company}
                {job.companyVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-limeAccent/15 px-2 py-0.5 text-xs font-bold text-limeAccent">
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    {t('job.verified')}
                  </span>
                )}
              </span>
              <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-sm text-white/75" suppressHydrationWarning>
                {meta.map((m) => <span key={m}>{m}</span>)}
              </div>
            </div>
            <div className="hidden shrink-0 flex-wrap items-center gap-2.5 md:flex">
              <SaveJobButton jobId={job.id} variant="onDark" label={`${t('search.save')} ${job.title}`} />
              <button type="button" onClick={share} aria-label={t('job.share')} className={`grid h-11 w-11 place-items-center rounded-md border border-white/25 text-white hover:bg-white/10 ${focusRing}`}>
                <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
              {applyControl('lime')}
            </div>
          </div>
          {shareNote && <p role="status" className="text-sm font-semibold text-limeAccent">{shareNote}</p>}
        </div>
      </section>

      {/* ── Body ── */}
      <div className={`${wrap} flex flex-col gap-6 pb-6 pt-6 md:flex-row md:items-start md:gap-7 md:pt-8`}>
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <section aria-labelledby="about-h" className={`${card} flex flex-col gap-3.5 p-5 md:p-8`}>
            <h2 id="about-h" className="text-xl font-bold text-ink-900 dark:text-white">{t('job.about')}</h2>
            {description.length > 0 ? <Blocks blocks={description} /> : <p className="text-[15px] text-ink-600">{t('job.noDescription')}</p>}
            {requirements.length > 0 && (
              <>
                <h3 className="mt-2.5 text-base font-bold text-ink-900 dark:text-white">{t('job.requirements')}</h3>
                <Blocks blocks={requirements} />
              </>
            )}
            {job.tags && job.tags.length > 0 && (
              <ul aria-label={t('job.skills')} className="flex flex-wrap gap-2 pt-2">
                {job.tags.map((tag) => (
                  <li key={tag} className="rounded-full bg-ink-100 px-3 py-1.5 text-[13px] font-semibold text-ink-700 dark:bg-slate-800 dark:text-slate-300">{tag}</li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="co-h" className={`${card} flex flex-col gap-3.5 p-5 md:p-8`}>
            <div className="flex items-center gap-3.5">
              <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl bg-primary text-[17px] font-extrabold text-limeAccent" aria-hidden="true">{initials(job.company)}</span>
              <div className="flex flex-col gap-0.5">
                <h2 id="co-h" className="text-lg font-bold text-ink-900 dark:text-white">{job.company}</h2>
                {(job.companyIndustry || job.companySize) && (
                  <span className="text-sm text-ink-600 dark:text-slate-400">
                    {[job.companyIndustry, job.companySize && (/[a-z]/i.test(job.companySize) ? job.companySize : `${job.companySize} ${t('job.employees')}`)].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            </div>
            {job.companyDescription && <p className="text-[15px] leading-relaxed text-ink-700 dark:text-slate-300">{job.companyDescription}</p>}
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer nofollow" className={`inline-flex min-h-11 items-center gap-1.5 self-start rounded-md border border-ink-300 px-3.5 text-sm font-semibold text-ink-900 dark:border-slate-700 dark:text-white ${focusRing}`}>
                {t('job.website')} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </section>
        </main>

        <aside className="flex w-full shrink-0 flex-col gap-4 md:w-[340px]">
          <section aria-labelledby="ov-h" className={`${card} p-[22px]`}>
            <h2 id="ov-h" className="mb-1.5 text-base font-bold text-ink-900 dark:text-white">{t('job.overview')}</h2>
            <dl>
              {overview.map((row) => (
                <div key={row.k} className="flex justify-between gap-4 border-b border-ink-100 py-3 text-sm last:border-b-0 dark:border-slate-800">
                  <dt className="text-ink-600 dark:text-slate-400">{row.k}</dt>
                  <dd className="text-right font-bold text-ink-900 dark:text-white">{row.v}</dd>
                </div>
              ))}
            </dl>
            {days !== null && (
              <p
                className={`mt-3.5 rounded-md px-3.5 py-3 text-sm font-semibold ${
                  closed ? 'bg-ink-100 text-ink-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-[#FFF7E6] text-[#7A4B00] dark:bg-amber-950/40 dark:text-amber-200'
                }`}
                suppressHydrationWarning
              >
                {closed
                  ? `${t('job.closedOn')} ${closesOn}`
                  : `${days === 0 ? t('job.closesToday') : t('job.closesIn').replace('{n}', String(days))} · ${closesOn}`}
              </p>
            )}
            <div className="mt-3.5 hidden flex-col md:flex [&>*]:w-full">
              {closed ? (
                <Link href={category ? `/jobs?category=${encodeURIComponent(category.id)}` : '/jobs'} className={`flex min-h-12 items-center justify-center rounded-md bg-primary text-[15px] font-bold text-white ${focusRing}`}>
                  {t('job.findSimilar')}
                </Link>
              ) : applied && job.applyMethod === 'internal' ? (
                <Link href="/applications" className={`flex min-h-12 items-center justify-center rounded-md border border-ink-300 text-[15px] font-bold text-ink-900 dark:border-slate-700 dark:text-white ${focusRing}`}>
                  {t('job.apply.track')}
                </Link>
              ) : (
                applyControl('dark')
              )}
            </div>
            {!closed && job.applyMethod !== 'internal' && (externalUrl || email) && (
              <p className="mt-2.5 text-[13px] text-ink-600 dark:text-slate-400">{t(externalUrl ? 'job.externalNote' : 'job.emailNote')}</p>
            )}
          </section>

          <section aria-labelledby="safe-h" className={`${card} flex gap-3.5 px-[22px] py-5`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#EEF5EF] text-forest dark:bg-forest/20 dark:text-limeAccent">
              <ShieldCheck className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1.5">
              <h2 id="safe-h" className="text-[15px] font-bold text-ink-900 dark:text-white">{t('job.safeTitle')}</h2>
              <p className="text-sm leading-relaxed text-ink-600 dark:text-slate-400">{t('job.safeText')}</p>
            </div>
          </section>
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="sim-h" className={`${wrap} pb-28 pt-6 md:pb-[72px] md:pt-12`}>
          <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
            <h2 id="sim-h" className="text-xl font-extrabold tracking-[-0.02em] text-ink-900 md:text-2xl dark:text-white">{t('job.similar')}</h2>
            {category && (
              <Link href={`/jobs?category=${encodeURIComponent(category.id)}`} className="text-sm font-bold text-forest hover:underline dark:text-limeAccent">
                {t('job.seeAllIn').replace('{category}', categoryLabel(category, t))} →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3.5">
            {similar.map((s) => {
              const sPay = formatSalary(s, t('search.upTo'));
              return (
                <Link
                  key={s.id}
                  href={`/jobs/${s.id}`}
                  prefetch={false}
                  className={`${card} flex flex-col gap-2.5 p-5 text-ink-900 transition-shadow hover:shadow-card-hover dark:text-white ${focusRing}`}
                >
                  <b className="line-clamp-2 text-base">{s.title}</b>
                  <span className="truncate text-sm text-ink-600 dark:text-slate-400">{[s.company, s.location].filter(Boolean).join(' · ')}</span>
                  <span className="mt-auto flex justify-between gap-3 border-t border-ink-100 pt-2.5 text-sm dark:border-slate-800">
                    <b>{sPay ?? t('landing.salaryNotListed')}</b>
                    <span className="shrink-0 text-ink-600 dark:text-slate-400" suppressHydrationWarning>{postedAgo(s.createdAt, locale, s.postedAgo)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Mobile action bar ── */}
      <div data-mobile-action-bar className="sticky bottom-[72px] z-30 flex gap-2.5 border-t border-ink-200 bg-surface px-4 pb-4 pt-3 shadow-[0_-8px_24px_rgba(4,22,3,0.08)] md:hidden dark:border-slate-800 dark:bg-slate-900">
        <SaveJobButton jobId={job.id} variant="outline" label={`${t('search.save')} ${job.title}`} />
        <button type="button" onClick={share} aria-label={t('job.share')} className={`grid h-11 w-11 shrink-0 place-items-center rounded-md border border-ink-200 text-ink-900 dark:border-slate-700 dark:text-white ${focusRing}`}>
          <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <div className="flex flex-1 [&>*]:w-full">
          {closed ? (
            <span className="flex min-h-12 items-center justify-center rounded-md bg-ink-100 text-[15px] font-bold text-ink-700 dark:bg-slate-800 dark:text-slate-300">{t('job.closed')}</span>
          ) : (
            applyControl('dark')
          )}
        </div>
      </div>

      {applyOpen && (
        <ApplyDialog
          jobId={job.id}
          jobTitle={job.title}
          company={job.company}
          onClose={() => setApplyOpen(false)}
          onApplied={() => setApplied(true)}
        />
      )}
    </>
  );
}

/** Description blocks rendered as text: listing HTML never reaches the page. */
function Blocks({ blocks }: { blocks: DescriptionBlock[] }) {
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-[1.7] text-ink-700 md:text-base dark:text-slate-300">
      {blocks.map((block, i) =>
        block.kind === 'heading' ? (
          <h3 key={i} className="mt-2 text-base font-bold text-ink-900 dark:text-white">{block.text}</h3>
        ) : block.kind === 'list' ? (
          <ul key={i} className="flex list-disc flex-col gap-2 pl-5">
            {block.items.map((item, j) => <li key={j}>{item}</li>)}
          </ul>
        ) : (
          <p key={i}>{block.text}</p>
        ),
      )}
    </div>
  );
}
