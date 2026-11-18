import { Suspense } from 'react';
import EmployerDashboard from '@/features/dashboard/EmployerDashboard';

export default function EmployerPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <EmployerDashboard />
    </Suspense>
  );
}
