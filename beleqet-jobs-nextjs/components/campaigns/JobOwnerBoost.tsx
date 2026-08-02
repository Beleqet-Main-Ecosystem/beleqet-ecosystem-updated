'use client';

import BoostPromoteModal from '@/components/campaigns/BoostPromoteModal';
import { useAuth } from '@/components/AuthProvider';

/**
 * Shows Boost CTA on job detail for listing owners (employer/admin).
 */
export default function JobOwnerBoost({
  jobId,
  jobTitle,
}: {
  jobId: string;
  jobTitle: string;
}) {
  const { user, ready } = useAuth();
  if (!ready || !user || !['EMPLOYER', 'ADMIN'].includes(user.role)) return null;

  return (
    <div className="rounded-2xl border border-border bg-white p-6">
      <BoostPromoteModal targetType="JOB" targetId={jobId} targetTitle={jobTitle} />
    </div>
  );
}
