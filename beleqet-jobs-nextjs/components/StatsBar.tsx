/**
 * StatsBar — server component that shows live platform metrics.
 *
 * Data is fetched from `GET /jobs/stats` at build time and revalidated every
 * 5 minutes via Next.js ISR (incremental static regeneration).  If the API is
 * unavailable, `fetchPlatformStats` automatically returns static fallback
 * values so the component never breaks.
 */

import { fetchPlatformStats } from '@/lib/api';
import StatsBarClient from './StatsBarClient';

// Revalidate every 5 minutes for ISR (matches the component's export context)
export const revalidate = 300;

export default async function StatsBar() {
  const stats = await fetchPlatformStats();

  return (
    <section className="border-y border-primary/10 bg-[#d8ff3e]">
      <StatsBarClient stats={stats} />
    </section>
  );
}
