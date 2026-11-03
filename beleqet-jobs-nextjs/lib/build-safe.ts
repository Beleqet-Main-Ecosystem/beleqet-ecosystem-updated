import axios from 'axios';

/** One-line description of a failed request, instead of axios's full object dump. */
export function describeError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const url = `${err.config?.baseURL ?? ''}${err.config?.url ?? ''}`;
    const status = err.response?.status ?? err.code ?? 'network error';
    return `${status} ${err.config?.method?.toUpperCase() ?? 'GET'} ${url}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Loads data for an ISR page. During `next build` there may be no API, so a
 * failure renders `empty` and the build continues; at runtime it rethrows so
 * Next.js keeps serving the last good page instead of caching an empty one.
 */
export async function loadForPage<T>(label: string, fn: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[${label}] ${describeError(err)}`);
    if (process.env.NEXT_PHASE === 'phase-production-build') return empty;
    throw err;
  }
}
