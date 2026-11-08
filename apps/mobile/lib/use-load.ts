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
  // A generic hook: the caller lists what `load` depends on, as with useEffect.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  const run = useCallback(load, deps);

  const fetchNow = useCallback(
    async (mode: 'first' | 'refresh' | 'quiet') => {
      const mine = ++generation.current;
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

  // New inputs (another id, say) show the spinner again; noticed during render, as React advises.
  const [shownFor, setShownFor] = useState(() => run);
  if (shownFor !== run) {
    setShownFor(() => run);
    setLoading(enabled);
  }

  useEffect(() => {
    if (!enabled) return;
    loaded.current = false;
    // Fetching on mount: state is set only after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // Nothing is loading while the load is switched off.
    loading: enabled && loading,
    refreshing,
    reload: () => {
      setLoading(true);
      return fetchNow('first');
    },
    refresh: () => {
      setRefreshing(true);
      return fetchNow('refresh');
    },
    setData,
  };
}
