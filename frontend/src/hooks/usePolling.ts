'use client';
/**
 * usePolling hook - reusable data-fetching hook with configurable polling interval.
 * Used by both AdminDashboard and DisputePanel to keep data fresh automatically.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePollingResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic polling hook that repeatedly calls an async fetcher at a set interval.
 * @param fetcher - Async function to call
 * @param interval - Polling interval in milliseconds (default: 10000ms)
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  interval: number = 10000,
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, interval);
    return () => clearInterval(timer);
  }, [fetchData, interval]);

  return { data, loading, error, refetch: fetchData };
}
