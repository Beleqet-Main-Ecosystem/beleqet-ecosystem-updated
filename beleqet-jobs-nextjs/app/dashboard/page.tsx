import { Suspense } from 'react';
import SeekerDashboard from '@/features/dashboard/SeekerDashboard';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <SeekerDashboard />
    </Suspense>
  );
}
