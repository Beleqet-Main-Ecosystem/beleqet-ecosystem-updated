'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFreelanceJob } from '@/lib/api';
import { MatchmakerDashboard } from '@/components/Matching/MatchmakerDashboard';

/**
 * Employer-facing AI Matchmaker page for a single freelance job.
 * Route: /employer/jobs/:jobId/matches
 */
export default function JobMatchesPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;

  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getFreelanceJob(jobId)
      .then((job) => {
        if (!cancelled) setJobTitle(job.title);
      })
      .catch(() => {
        if (!cancelled) setTitleError('Untitled job');
      });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <div className="min-h-screen bg-white px-4 py-10">
      <MatchmakerDashboard jobId={jobId} jobTitle={jobTitle ?? titleError ?? 'Loading...'} />
    </div>
  );
}