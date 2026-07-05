'use client';

import { useState } from 'react';
import JobCard from '@/components/JobCard';
import type { Job } from '@/lib/api';

interface FeedClientProps {
  initialJobs: Job[];
  userId: string;
}

export default function FeedClient({ initialJobs, userId }: FeedClientProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(true);

  const toggleGDPR = async () => {
    const newVal = !gdprConsent;
    setGdprConsent(newVal);
    setLoading(true);

    try {
      await fetch('/api/v1/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gdprConsent: newVal }),
      }).catch(() => {});

      const res = await fetch(`/api/v1/ai-feed?limit=5`);
      const data: Job[] = await res.json();
      setJobs(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading) {
    return <p className="text-gray-600">Updating recommendations...</p>;
  }

  return (
    <div>
      <button
        onClick={toggleGDPR}
        className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm font-medium transition"
      >
        {gdprConsent ? 'Disable AI Personalization (GDPR)' : 'Enable AI Personalization'}
      </button>

      {jobs.length === 0 ? (
        <p className="text-gray-500">No matching jobs found.</p>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job: Job) => (
            <JobCard key={job.id} job={job} showMatchScore />
          ))}
        </div>
      )}
    </div>
  );
    }
