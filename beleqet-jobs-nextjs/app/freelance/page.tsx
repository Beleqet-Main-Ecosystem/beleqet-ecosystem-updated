import type { Metadata } from 'next';
import { freelancePageMetadata } from '@/lib/seo/generate-metadata';
import { fetchOpenGigs } from '@/lib/api';
import FreelancePageClient from './FreelancePageClient';

export const metadata: Metadata = freelancePageMetadata();

export const revalidate = 60;

export default async function FreelancePage() {
  // Live gigs from the API — FreelancePageClient falls back to built-in sample gigs when empty.
  const gigs = await fetchOpenGigs(24).catch(() => []);

  // Map to the card shape the client component renders; raw API records lack these display fields.
  const cards = gigs.map((g) => ({
    id: g.id,
    title: g.title,
    categorySlug: g.categorySlug,
    budget:
      g.budgetMin && g.budgetMax && g.budgetMin !== g.budgetMax
        ? `${g.budgetMin.toLocaleString('en-US')}–${g.budgetMax.toLocaleString('en-US')}`
        : (g.budgetMax || g.budgetMin).toLocaleString('en-US'),
    budgetUnit: g.currency,
    type: g.pricingType === 'HOURLY' ? ('Hourly' as const) : ('Fixed' as const),
    client: '',
    skills: g.skills,
    posted: g.postedAgo,
    escrow: true,
  }));

  return <FreelancePageClient gigs={cards} />;
}
