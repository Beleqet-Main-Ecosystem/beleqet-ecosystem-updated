'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { muted } from './ui';

export type Point = { label: string; value: number };

/** Rounds the top of the axis up to a clean number (1, 2, 5 × 10ⁿ). */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].find((m) => m * power >= max) ?? 10;
  return step * power;
}

/**
 * One series over time as columns: 4px rounded tops, 24px at most, 2px gaps, a hairline grid,
 * values on hover and focus, and a table view so nothing depends on seeing the chart.
 */
export default function ColumnChart({ title, points, format }: { title: string; points: Point[]; format: (value: number) => string }) {
  const { t } = useI18n();
  const [table, setTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...points.map((point) => point.value)));
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const shown = active === null ? null : points[active];

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span>
          <b className="text-ink-900 dark:text-white">{title}</b>
          <span className={`${muted} ml-2`}>{t('dashboard.total', { total: format(total) })}</span>
        </span>
        {total > 0 && <button type="button" onClick={() => setTable(!table)} className="text-xs font-bold text-forest hover:underline dark:text-limeAccent">
          {table ? t('dashboard.showChart') : t('dashboard.showTable')}
        </button>}
      </figcaption>

      {total === 0 ? (
        <p className={`${muted} flex h-[180px] items-center justify-center`}>{t('dashboard.nothing')}</p>
      ) : table ? (
        <div className="max-h-[220px] overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {points.map((point) => (
                <tr key={point.label} className="border-t border-ink-100 dark:border-slate-800">
                  <td className="py-1.5 text-ink-600 dark:text-slate-400">{point.label}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums text-ink-900 dark:text-white">{format(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex h-[180px] flex-col justify-between pb-5 text-right text-[11px] tabular-nums text-ink-500 dark:text-slate-400">
            <span>{format(top)}</span>
            <span>{format(top / 2)}</span>
            <span>0</span>
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute inset-x-0 top-[7px] h-px bg-ink-100 dark:bg-slate-800" />
            <div className="pointer-events-none absolute inset-x-0 top-[calc(50%-10px)] h-px bg-ink-100 dark:bg-slate-800" />
            <div className="flex h-[160px] items-end gap-[2px] border-b border-ink-200 dark:border-slate-700" onMouseLeave={() => setActive(null)}>
              {points.map((point, index) => (
                <button
                  key={point.label}
                  type="button"
                  aria-label={`${point.label}: ${format(point.value)}`}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  className="flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
                >
                  <span
                    className={`block w-full max-w-[24px] rounded-t-[4px] ${active === index ? 'bg-obsidian dark:bg-limeAccent' : 'bg-forest dark:bg-brand-500'}`}
                    style={{ height: point.value > 0 ? `max(2px, ${(point.value / top) * 100}%)` : 0 }}
                  />
                </button>
              ))}
            </div>
            <div className="flex h-5 justify-between pt-1 text-[11px] text-ink-500 dark:text-slate-400">
              <span>{points[0]?.label}</span>
              <span aria-live="polite" className="font-semibold text-ink-900 dark:text-white">{shown ? `${shown.label} · ${format(shown.value)}` : ''}</span>
              <span>{points[points.length - 1]?.label}</span>
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
