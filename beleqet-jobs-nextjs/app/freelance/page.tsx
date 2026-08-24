import type { Metadata } from 'next';
import { freelancePageMetadata } from '@/lib/seo/generate-metadata';
import FreelancePageClient from './FreelancePageClient';

export const metadata: Metadata = freelancePageMetadata();

export default function FreelancePage() {
  return <FreelancePageClient />;
}
