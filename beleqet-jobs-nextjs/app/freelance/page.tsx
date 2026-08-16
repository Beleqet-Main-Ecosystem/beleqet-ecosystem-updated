import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/generate-metadata';
import FreelancePageClient from './FreelancePageClient';

export const metadata: Metadata = createMetadata({
  title: 'Hire Top Ethiopian Freelancers & Find Projects | Beleqet Freelance',
  description:
    'Post freelance projects or work as a freelancer in Ethiopia with protected Escrow payments.',
  path: '/freelance',
  ogType: 'website',
});

export default function FreelancePage() {
  return <FreelancePageClient />;
}
