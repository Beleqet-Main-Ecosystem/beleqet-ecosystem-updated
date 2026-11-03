import type { Metadata } from 'next';
import PostProject from '@/features/freelance/components/PostProject';
import { fetchGigCategories } from '@/lib/api';
import { createMetadata } from '@/lib/seo/generate-metadata';

export const metadata: Metadata = createMetadata({
  title: 'Post a project',
  description: 'Post a freelance project for free, compare bids, and pay safely through BeleqetSafe escrow.',
  path: '/freelance/post',
});

export default async function PostProjectPage() {
  return <PostProject categories={await fetchGigCategories()} />;
}
