'use client';

import { useEffect, useState } from 'react';

function toShortDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

export default function RelativeTime({
  dateStr,
  fallback,
  locale = 'en',
  justNow = 'Just now',
}: {
  dateStr?: string | null;
  fallback?: string;
  locale?: string;
  justNow?: string;
}) {
  const [formatted, setFormatted] = useState<string | null>(fallback || toShortDate(dateStr));

  useEffect(() => {
    if (!dateStr) return;
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return;
    const hours = Math.floor((Date.now() - time) / 3_600_000);
    if (hours < 1) {
      setFormatted(justNow);
      return;
    }
    try {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      setFormatted(hours < 24 ? rtf.format(-hours, 'hour') : rtf.format(-Math.floor(hours / 24), 'day'));
    } catch {
      setFormatted(hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`);
    }
  }, [dateStr, locale, justNow]);

  if (!formatted) return null;

  return (
    <time
      dateTime={dateStr || undefined}
      className="ml-auto text-xs text-ink-500"
    >
      {formatted}
    </time>
  );
}
