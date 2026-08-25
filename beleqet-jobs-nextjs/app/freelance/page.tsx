import type { Metadata } from 'next';
import { freelancePageMetadata } from '@/lib/seo/generate-metadata';
import FreelancePageClient from './FreelancePageClient';

export const metadata: Metadata = freelancePageMetadata();

export const revalidate = 60;

export default async function FreelancePage() {
  // Fetch live gigs from the API — falls back to built-in static data in FreelancePageClient
  let gigs: object[] = [];
  try {
    const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';
    const res = await fetch(`${API}/freelance/jobs?limit=24&status=OPEN`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = await res.json();
      gigs = data.items ?? [];
    }
  } catch {
    // Network unreachable in dev/build — FreelancePageClient uses FALLBACK_GIGS
  }

  return <FreelancePageClient gigs={gigs as never} />;
}
