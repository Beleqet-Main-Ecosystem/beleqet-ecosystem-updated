import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import GigDetail from '@/features/freelance/components/GigDetail';
import { fetchGig } from '@/lib/api';
import { createMetadata } from '@/lib/seo/generate-metadata';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const gig = await fetchGig(params.id);
  return createMetadata({
    title: gig?.title ?? 'Project not found',
    description: gig?.description.slice(0, 155) ?? '',
    path: `/freelance/${params.id}`,
  });
}

export default async function GigDetailPage({ params }: { params: { id: string } }) {
  // fetchGig is request-cached, so this and generateMetadata share one API call.
  const gig = await fetchGig(params.id);
  if (!gig) notFound();
  return <GigDetail gig={gig} />;
}
