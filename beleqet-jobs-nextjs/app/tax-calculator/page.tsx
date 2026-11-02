'use client';

import { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { calculateTax, EMPLOYEE_PENSION, EMPLOYER_PENSION } from '@/features/tax/calculate';

const card = 'rounded-xl border border-ink-200 bg-surface p-5 md:p-6 dark:border-slate-800 dark:bg-slate-900';

export default function TaxCalculatorPage() {
  const { t } = useTranslation();
  const [raw, setRaw] = useState('');
  const [pensionOn, setPensionOn] = useState(true);
  const [yearly, setYearly] = useState(false);

  const gross = Math.max(0, Number(raw.replace(/[^0-9.]/g, '')) || 0);
  const { rows, tax, pension, net, top } = calculateTax(gross, pensionOn);
  const money = (value: number) => `ETB ${Math.round(value * (yearly ? 12 : 1)).toLocaleString('en-US')}`;
  const percent = (value: number) => (gross > 0 ? `${((value / gross) * 100).toFixed(1)}%` : '0%');
  const share = (value: number) => (gross > 0 ? `${Math.max(0, (value / gross) * 100)}%` : '0%');
  const range = (from: number, to: number) =>
    to === Infinity ? t('tax.over').replace('{amount}', from.toLocaleString('en-US')) : `${from.toLocaleString('en-US')} – ${to.toLocaleString('en-US')}`;

  const segment = (on: boolean) => `min-h-[38px] rounded-[7px] px-3.5 text-sm ${on ? 'bg-obsidian font-bold text-white dark:bg-limeAccent dark:text-obsidian' : 'font-semibold text-ink-700 dark:text-slate-300'}`;

  return (
    <>
      <section className="bg-obsidian text-white">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-2.5 px-4 pb-8 pt-5 md:px-[clamp(16px,4vw,40px)] md:pb-10 md:pt-8">
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em] md:text-[clamp(28px,3vw,38px)]">{t('tax.title')}</h1>
          <p className="max-w-[620px] text-[15px] leading-relaxed text-white/75">{t('tax.sub')}</p>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 pb-14 pt-5 md:px-[clamp(16px,4vw,40px)] md:pb-16 md:pt-8">
        <p role="note" className="rounded-lg border border-[#F0D9A8] bg-[#FFF7E6] p-3.5 text-sm leading-normal text-[#7A4B00] dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-200">{t('tax.bandsWarning')}</p>

        <div className="flex flex-wrap items-start gap-4">
          <form onSubmit={(event) => event.preventDefault()} className={`${card} flex min-w-0 flex-[1_1_320px] flex-col gap-4`}>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-ink-900 dark:text-white">{t('tax.gross')}</span>
              <span className="flex min-h-12 items-center gap-2 rounded-lg border border-ink-300 px-3.5 focus-within:ring-2 focus-within:ring-forest dark:border-slate-700">
                <span className="text-sm font-bold text-ink-500 dark:text-slate-400">ETB</span>
                <input type="text" inputMode="decimal" value={raw} onChange={(event) => setRaw(event.target.value)} className="w-full min-w-0 bg-transparent text-lg font-bold text-ink-900 outline-none dark:text-white" />
              </span>
              <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('tax.grossHint')}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={pensionOn} onChange={() => setPensionOn(!pensionOn)} className="mt-0.5 h-5 w-5 accent-primary" />
              <span className="flex flex-col gap-0.5">
                <b className="text-[15px] text-ink-900 dark:text-white">{t('tax.pension')}</b>
                <span className="text-[13px] text-ink-500 dark:text-slate-400">{t('tax.pensionHint')}</span>
              </span>
            </label>
            <p className="text-[13px] leading-normal text-ink-500 dark:text-slate-400">{t('tax.estimate')}</p>
          </form>

          <section aria-live="polite" className={`${card} flex min-w-0 flex-[1_1_320px] flex-col gap-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-ink-500 dark:text-slate-400">{t('tax.takeHome')}</span>
              <span className="inline-flex gap-1 rounded-[9px] bg-[#F1F4F6] p-1 dark:bg-slate-800">
                <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)} className={segment(!yearly)}>{t('tax.monthly')}</button>
                <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)} className={segment(yearly)}>{t('tax.yearly')}</button>
              </span>
            </div>
            <p className="flex flex-wrap items-baseline gap-2">
              <b className="text-[34px] tracking-[-0.03em] text-ink-900 dark:text-white">{money(net)}</b>
              <span className="text-sm text-ink-500 dark:text-slate-300">{t(yearly ? 'tax.aYear' : 'tax.aMonth')}</span>
            </p>
            {gross > 0 ? (
              <>
                <div className="flex h-3 overflow-hidden rounded-full bg-[#F1F4F6] dark:bg-slate-800" aria-hidden="true">
                  <span className="bg-forest dark:bg-limeAccent" style={{ width: share(net) }} />
                  <span className="bg-[#D8A100]" style={{ width: share(tax) }} />
                  <span className="bg-ink-400" style={{ width: share(pension) }} />
                </div>
                <dl className="flex flex-col gap-1.5 text-sm">
                  <Row label={t('tax.keep')} value={money(net)} />
                  <Row label={`${t('tax.incomeTax')} · ${percent(tax)}`} value={money(tax)} />
                  <Row label={`${t('tax.pensionShort')} · ${pensionOn ? `${EMPLOYEE_PENSION * 100}%` : t('tax.off')}`} value={money(pension)} />
                </dl>
              </>
            ) : (
              <span className="text-sm text-ink-500 dark:text-slate-300">{t('tax.enterSalary')}</span>
            )}
          </section>
        </div>

        <section aria-labelledby="bands-h" className={`${card} flex flex-col gap-3`}>
          <div>
            <h2 id="bands-h" className="text-lg font-bold text-ink-900 dark:text-white">{t('tax.howTitle')}</h2>
            <p className="text-sm text-ink-500 dark:text-slate-300">
              {t('tax.howText')} {top && <>{t('tax.topBand')} <b>{Math.round(top.rate * 100)}%</b></>}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-ink-500 dark:border-slate-800 dark:text-slate-400">
                  <th scope="col" className="py-2 pr-3 font-bold">{t('tax.band')}</th>
                  <th scope="col" className="py-2 pr-3 font-bold">{t('tax.rate')}</th>
                  <th scope="col" className="py-2 font-bold">{t('tax.taxOnBand')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.from} className={`border-b border-[#F1F4F6] text-ink-900 last:border-0 dark:border-slate-800 dark:text-slate-200 ${row === top ? 'bg-[#F1F7EC] font-bold dark:bg-forest/20' : ''}`}>
                    <td className="py-2 pr-3">{range(row.from, row.to)}</td>
                    <td className="py-2 pr-3">{Math.round(row.rate * 100)}%</td>
                    <td className="py-2">{row.slice > 0 ? money(row.tax) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {gross > 0 && pensionOn && (
            <p className="text-[13px] text-ink-500 dark:text-slate-400">{t('tax.employerPension').replace('{amount}', money(gross * EMPLOYER_PENSION))}</p>
          )}
        </section>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-500 dark:text-slate-300">{label}</dt>
      <dd className="font-bold text-ink-900 dark:text-white">{value}</dd>
    </div>
  );
}
