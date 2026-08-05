/** Display helpers for Admin Stats (minor units → readable money). */

export function formatMinorMoney(amount: number, currency: string): string {
  const major = amount / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;
  }
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatShortDate(isoOrYmd: string): string {
  if (/^\d{4}-\d{2}$/.test(isoOrYmd)) return isoOrYmd;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    const d = new Date(`${isoOrYmd}T12:00:00Z`);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  const d = new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return isoOrYmd;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatChartTick(date: string, granularity: 'day' | 'month'): string {
  if (granularity === 'month' || /^\d{4}-\d{2}$/.test(date)) {
    const [y, m] = date.split('-');
    const label = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleDateString(undefined, {
      month: 'short',
    });
    return `${label} ${y?.slice(2) ?? ''}`.trim();
  }
  return formatShortDate(date);
}
