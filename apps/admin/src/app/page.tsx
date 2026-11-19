'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Sends people to the dashboard (which sends them to sign in if needed). Done in the
 * browser so `/` answers 200: health checks and load balancers probe this address.
 */
export default function Home() {
  const router = useRouter();
  useEffect(() => router.replace('/dashboard'), [router]);
  return <div className="min-h-screen" />;
}
