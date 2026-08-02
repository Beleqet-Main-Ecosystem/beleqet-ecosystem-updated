'use client';

import { useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';
import BoostPromoteModal from '@/components/campaigns/BoostPromoteModal';
import { useTranslation } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type Bid = {
  id: string;
  amount: number;
  status: string;
  coverLetter: string;
  freelanceJob?: { title: string };
};

/**
 * Freelancer proposals (bids) with Boost / Promote for PROPOSAL targetType.
 */
export default function MyBidsPage() {
  const { user, ready } = useAuth();
  const { t } = useTranslation();
  const [bids, setBids] = useState<Bid[]>([]);

  useEffect(() => {
    if (!user) return;
    authenticatedFetch(`${API_URL}/freelance/my-bids`).then(async (res) => {
      if (res.ok) setBids(await res.json());
    });
  }, [user]);

  if (!ready || !user) {
    return <div className="container-page py-16 text-muted">{t('campaigns.loginRequired')}</div>;
  }

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-black text-primary">{t('campaigns.boostTitle')}</h1>
      <div className="mt-8 space-y-4">
        {bids.length === 0 ? (
          <p className="text-muted">{t('campaigns.empty')}</p>
        ) : (
          bids.map((bid) => (
            <article key={bid.id} className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-5 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-extrabold text-primary">
                  {bid.freelanceJob?.title ?? bid.id}
                </h2>
                <p className="text-xs text-muted">
                  {bid.status} · {bid.amount}
                </p>
              </div>
              <BoostPromoteModal
                targetType="PROPOSAL"
                targetId={bid.id}
                targetTitle={bid.freelanceJob?.title}
                compact
              />
            </article>
          ))
        )}
      </div>
    </div>
  );
}
