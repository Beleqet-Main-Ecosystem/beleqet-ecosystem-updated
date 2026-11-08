import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { useFocusEffect } from 'expo-router';

type Load<T> = {
  data: T | undefined;
  error: unknown;
  /** True on the first load (show a spinner), not on pull-to-refresh. */
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  setData: (update: T | ((current: T | undefined) => T)) => void;
};

/**
 * Loads data for a screen and tracks the states every screen shows: loading, failed (with retry),
 * refreshing. `refetchOnFocus` reloads quietly when the user comes back to the screen.
 */
export function useLoad<T>(load: () => Promise<T>, deps: DependencyList, options: { refetchOnFocus?: boolean; enabled?: boolean } = {}): Load<T> {
  const { refetchOnFocus = false, enabled = true } = options;
  const [data, setDataState] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const loaded = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const fetchNow = useCallback(
    async (mode: 'first' | 'refresh' | 'quiet') => {
      const mine = ++generation.current;
      if (mode === 'first') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        const next = await run();
        if (mine !== generation.current) return;
        setDataState(next);
        setError(null);
        loaded.current = true;
      } catch (failure) {
        if (mine !== generation.current) return;
        // A failed quiet reload keeps what is on screen.
        if (mode !== 'quiet' || !loaded.current) setError(failure);
      } finally {
        if (mine === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [run],
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    loaded.current = false;
    void fetchNow('first');
  }, [fetchNow, enabled]);

  useFocusEffect(
    useCallback(() => {
      if (refetchOnFocus && enabled && loaded.current) void fetchNow('quiet');
    }, [refetchOnFocus, enabled, fetchNow]),
  );

  const setData = useCallback((update: T | ((current: T | undefined) => T)) => {
    setDataState((current) => (typeof update === 'function' ? (update as (c: T | undefined) => T)(current) : update));
  }, []);

  return {
    data,
    error,
    loading,
    refreshing,
    reload: () => fetchNow('first'),
    refresh: () => fetchNow('refresh'),
    setData,
  };
}
