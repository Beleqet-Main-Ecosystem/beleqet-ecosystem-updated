import { fetchFeed } from '@/lib/api';

export default async function FeedPage() {
  const userId = 'mock-user-id'; // In production, get from session

  try {
    const jobs = await fetchFeed(userId, 5);
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[#00653B] mb-6">
          Your Personalized Job Feed
        </h1>
        <FeedClient initialJobs={jobs} userId={userId} />
      </div>
    );
  } catch (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-500">Failed to load feed.</p>
      </div>
    );
  }
}

import FeedClient from './FeedClient';
