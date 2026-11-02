'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ShieldCheck } from 'lucide-react';
import type { Plan } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

const FAQS = ['needPlan', 'howPay', 'cancel', 'expires', 'escrow'] as const;

type Features = { maxJobPosts?: number; maxFreelanceBids?: number; featuredListing?: boolean; apiAccess?: boolean; support?: string };

const featuresOf = (plan: Plan) => (plan.features ?? {}) as Features;

export default function PricingPage({ plans }: { plans: Plan[] }) {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState(0);

  const limit = (value?: number) => (value === undefined ? '—' : value < 0 ? t('pricing.unlimited') : String(value));
  const included = (value?: boolean) => (value ? t('pricing.included') : '—');
  const support = (plan: Plan) => {
    const level = featuresOf(plan).support;
    return level ? t(`pricing.support.${level}`) : '—';
  };

  const price = (plan: Plan) => `${plan.currency} ${(plan.priceAmount / 100).toLocaleString('en-US')}`;
  // Middle of three plans, so it still works if an admin renames them.
  const recommendedIndex = plans.length === 3 ? 1 : -1;

  const featureList = (plan: Plan) => {
    const features = featuresOf(plan);
    return [
      t('pricing.jobPosts').replace('{count}', limit(features.maxJobPosts)),
      t('pricing.bids').replace('{count}', limit(features.maxFreelanceBids)),
      features.featuredListing && t('pricing.featuredListings'),
      features.apiAccess && t('pricing.api'),
      features.support && t('pricing.supportLine').replace('{level}', support(plan)),
    ].filter(Boolean) as string[];
  };

  const rows: { key: string; cell: (plan: Plan) => string }[] = [
    { key: t('pricing.rowPosts'), cell: (plan) => limit(featuresOf(plan).maxJobPosts) },
    { key: t('pricing.rowBids'), cell: (plan) => limit(featuresOf(plan).maxFreelanceBids) },
    { key: t('pricing.rowFeatured'), cell: (plan) => included(featuresOf(plan).featuredListing) },
    { key: t('pricing.rowApi'), cell: (plan) => included(featuresOf(plan).apiAccess) },
    { key: t('pricing.rowSupport'), cell: support },
    { key: t('pricing.rowFee'), cell: () => '10%' },
  ];

  return (
    <>
      <section className="bg-obsidian text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3 px-4 pb-10 pt-6 text-center md:px-[clamp(16px,4vw,40px)] md:pb-14 md:pt-10">
          <h1 className="text-[28px] font-extrabold tracking-[-0.03em] md:text-[clamp(30px,3.4vw,42px)]">{t('pricing.title')}</h1>
          <p className="max-w-[620px] text-[15px] leading-relaxed text-white/75 md:text-base">{t('pricing.sub')}</p>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pb-14 pt-6 md:gap-12 md:px-[clamp(16px,4vw,40px)] md:pb-20 md:pt-10">
        {plans.length === 0 ? (
          <p role="status" className="rounded-xl border border-ink-200 bg-surface p-8 text-center text-[15px] text-ink-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {t('pricing.unavailable')}
          </p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan, index) => {
                const dark = index === recommendedIndex;
                const free = plan.priceAmount === 0;
                return (
                  <article
                    key={plan.id}
                    className={`flex flex-col gap-4 rounded-xl border p-6 ${dark ? 'border-[#0A2C03] bg-[#0A2C03] text-white' : 'border-ink-200 bg-surface text-ink-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white'}`}
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-xl font-extrabold">{plan.name}</h2>
                        {dark && <span className="rounded-md bg-limeAccent px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-obsidian">{t('pricing.recommended')}</span>}
                      </div>
                      {plan.description && <p className={`text-sm leading-normal ${dark ? 'text-white/70' : 'text-ink-500 dark:text-slate-300'}`}>{plan.description}</p>}
                    </div>
                    <p className="flex items-baseline gap-1.5">
                      <b className="text-[32px] tracking-[-0.03em]">{price(plan)}</b>
                      {!free && <span className={`text-sm ${dark ? 'text-white/70' : 'text-ink-500 dark:text-slate-300'}`}>/ {t('pricing.month')}</span>}
                    </p>
                    <Link
                      href={free ? '/register' : `/checkout?planId=${plan.id}`}
                      className={`inline-flex min-h-12 items-center justify-center rounded-lg border text-[15px] font-bold ${dark ? 'border-limeAccent bg-limeAccent text-obsidian' : 'border-ink-300 bg-surface text-ink-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white'}`}
                    >
                      {free ? t('pricing.createFree') : t('pricing.subscribe').replace('{plan}', plan.name)}
                    </Link>
                    <ul className="flex flex-col gap-2">
                      {featureList(plan).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm leading-normal">
                          <Check className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? 'text-limeAccent' : 'text-forest dark:text-limeAccent'}`} aria-hidden="true" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>

            <section aria-labelledby="cmp-h" className="flex flex-col gap-3">
              <h2 id="cmp-h" className="text-[22px] font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">{t('pricing.compare')}</h2>
              <div className="overflow-x-auto rounded-xl border border-ink-200 bg-surface dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 dark:border-slate-800">
                      <th scope="col" className="p-3.5 text-left font-bold text-ink-500 dark:text-slate-300">{t('pricing.feature')}</th>
                      {plans.map((plan) => (
                        <th key={plan.id} scope="col" className="p-3.5 text-left font-bold text-ink-900 dark:text-white">{plan.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.key} className="border-b border-[#F1F4F6] last:border-0 dark:border-slate-800">
                        <th scope="row" className="p-3.5 text-left font-semibold text-ink-900 dark:text-white">{row.key}</th>
                        {plans.map((plan) => (
                          <td key={plan.id} className="p-3.5 text-ink-700 dark:text-slate-300">{row.cell(plan)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <section aria-labelledby="esc-h" className="flex flex-wrap items-center gap-3.5 rounded-xl bg-[#EEF5EF] p-5 dark:bg-forest/20">
          <ShieldCheck className="h-6 w-6 shrink-0 text-forest dark:text-limeAccent" aria-hidden="true" />
          <span className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
            <b id="esc-h" className="text-base text-ink-900 dark:text-white">{t('pricing.escrowTitle')}</b>
            <span className="text-sm leading-normal text-ink-700 dark:text-slate-300">{t('pricing.escrowText')}</span>
          </span>
          <Link href="/freelance" className="text-sm font-bold text-forest hover:underline dark:text-limeAccent">{t('pricing.escrowLink')} →</Link>
        </section>

        <section aria-labelledby="faq-h" className="mx-auto flex w-full max-w-[760px] flex-col gap-3">
          <h2 id="faq-h" className="text-[22px] font-extrabold tracking-[-0.02em] text-ink-900 dark:text-white">{t('pricing.questions')}</h2>
          <div className="rounded-xl border border-ink-200 bg-surface dark:border-slate-800 dark:bg-slate-900">
            {FAQS.map((faq, index) => {
              const open = openFaq === index;
              return (
                <div key={faq} className="border-b border-[#F1F4F6] last:border-0 dark:border-slate-800">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? -1 : index)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left text-[15px] font-bold text-ink-900 dark:text-white"
                  >
                    {t(`pricing.faq.${faq}.q`)}
                    <span aria-hidden="true" className="text-lg">{open ? '−' : '+'}</span>
                  </button>
                  {open && <p className="px-4 pb-4 text-sm leading-relaxed text-ink-700 dark:text-slate-300">{t(`pricing.faq.${faq}.a`)}</p>}
                </div>
              );
            })}
          </div>
          <p className="text-sm text-ink-500 dark:text-slate-300">
            {t('pricing.moreQuestions')} <Link href="/contact" className="font-bold text-forest hover:underline dark:text-limeAccent">{t('pricing.contact')}</Link>
          </p>
        </section>
      </div>
    </>
  );
}
