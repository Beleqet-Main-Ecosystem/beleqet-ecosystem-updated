'use client';

import { useState } from 'react';
import JobCard from '@/components/JobCard';
import type { Job } from '@/lib/api';

interface FeedClientProps {
  /** The initial list of jobs fetched server-side. */
  initialJobs: Job[];
  /** The ID of the logged-in user, used to update GDPR preferences. */
  userId: string;
}

/**
 * Client-side component for the personalized job feed.
 * 
 * Displays a list of job cards and includes a toggle button to enable/disable
 * AI personalization (GDPR consent). When toggled, it updates the user's preference
 * and refetches the feed to reflect the change.
 */
export default function FeedClient({ initialJobs, userId }: FeedClientProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(true);

  /**
   * Toggles GDPR personalization consent for the current user.
   * 
   * 1. Sends a PATCH request to /api/v1/users/me to update the `gdprConsent` field.
   * 2. Refetches the /api/v1/ai-feed endpoint to display the updated list
   *    (personalized or generic depending on the new state).
   */
  const toggleGDPR = async () => {
    const newVal = !gdprConsent;
    setGdprConsent(newVal);
    setLoading(true);

    try {
      // Update user preference
      await fetch('/api/v1/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gdprConsent: newVal }),
      }).catch(() => {});

      // Refresh the feed
      const res = await fetch('/api/v1/ai-feed?limit=5');
      const data: Job[] = await res.json();
      setJobs(data);
    } catch (e) {
      console.error('Failed to update feed:', e);
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
