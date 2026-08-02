'use client';

import { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';
import BoostPromoteModal from '@/components/campaigns/BoostPromoteModal';
import { useTranslation } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Gig = { id: string; title: string; description: string; status: string };

/**
 * Minimal gig detail surface with Boost / Promote for GIG targetType.
 */
export default function FreelanceGigPage({ params }: { params: { id: string } }) {
  const { user, ready } = useAuth();
  const { t } = useTranslation();
  const [gig, setGig] = useState<Gig | null>(null);

  useEffect(() => {
    authenticatedFetch(`${API_URL}/freelance/jobs/${params.id}`).then(async (res) => {
      if (res.ok) setGig(await res.json());
    });
  }, [params.id]);

  if (!gig) {
    return <div className="container-page py-16 text-muted">{t('campaigns.loading')}</div>;
  }

  const canBoost =
    ready && user && ['EMPLOYER', 'ADMIN', 'FREELANCER'].includes(user.role);

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-black text-primary">{gig.title}</h1>
      <p className="mt-2 text-sm text-muted">{gig.status}</p>
      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-ink">{gig.description}</p>
      {canBoost && (
        <div className="mt-8 max-w-sm">
          <BoostPromoteModal targetType="GIG" targetId={gig.id} targetTitle={gig.title} />
        </div>
      )}
    </div>
  );
}
