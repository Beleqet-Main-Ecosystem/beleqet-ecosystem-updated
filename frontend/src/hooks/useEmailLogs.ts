import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchEmailLogs, fetchEmailLog, resendEmail } from '../lib/email_logs';
import type { EmailLog, EmailLogPage, EmailLogQuery } from '../types/email';

interface QueryState<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Server-state hook for the paginated, filtered logs table.
 * Re-fetches whenever `query` changes (compared by value, not
 * reference, so passing a fresh object literal each render is fine).
 * Exposes `refetch` so callers can re-pull after a mutation like resend.
 */
export function useEmailLogs(query: EmailLogQuery) {
  const [state, setState] = useState<QueryState<EmailLogPage>>({
    data: undefined,
    isLoading: true,
    error: null,
  });

  // Keep the previous page's data visible while the next page loads,
  // rather than flashing a loading state.
  const previousData = useRef<EmailLogPage | undefined>(undefined);

  const queryKey = JSON.stringify(query);

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await fetchEmailLogs(query);
      previousData.current = data;
      setState({ data, isLoading: false, error: null });
    } catch (err) {
      setState({
        data: previousData.current,
        isLoading: false,
        error: err instanceof Error ? err : new Error('Failed to load email logs'),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}

/** Server-state hook for a single log's detail panel. */
export function useEmailLog(id: string | null) {
  const [state, setState] = useState<QueryState<EmailLog>>({
    data: undefined,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ data: undefined, isLoading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    fetchEmailLog(id)
      .then((data) => {
        if (!cancelled) setState({ data, isLoading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            data: undefined,
            isLoading: false,
            error: err instanceof Error ? err : new Error('Failed to load email log'),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}

/**
 * Resend mutation. Does not manage cache invalidation itself (there's
 * no shared cache without a query library) — callers should call the
 * list hook's `refetch()` in `onSuccess` to reflect the new status.
 */
export function useResendEmail() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const resend = useCallback(async (id: string, onSuccess?: () => void) => {
    setIsPending(true);
    setError(null);
    try {
      await resendEmail(id);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to resend email'));
    } finally {
      setIsPending(false);
    }
  }, []);

  return { resend, isPending, error };
}
