import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';

/**
 * Turns a beleqetjobs.com address into the matching screen, so links shared from the website open
 * in the app: jobs, projects, contracts. Returns null for pages the app has no screen for.
 */
export function routeForUrl(url: string): string | null {
  const match = url.match(/^https?:\/\/(?:www\.)?beleqetjobs\.com(\/[^?#]*)?/i);
  if (!match) return null;
  const path = (match[1] ?? '/').replace(/\/+$/, '') || '/';
  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^\/jobs\/([^/]+)\/apply$/, (m) => `/job/apply/${m[1]}`],
    [/^\/jobs\/([^/]+)$/, (m) => `/job/${m[1]}`],
    [/^\/jobs$/, () => '/(tabs)/jobs'],
    [/^\/freelance\/contracts\/([^/]+)$/, (m) => `/contract/${m[1]}`],
    [/^\/freelance\/post$/, () => '/post-project'],
    [/^\/freelance\/wallet$/, () => '/wallet'],
    [/^\/freelance\/([^/]+)$/, (m) => `/gig/${m[1]}`],
    [/^\/freelance$/, () => '/(tabs)/freelance'],
    [/^\/forum\/([^/]+)$/, (m) => `/forum/${m[1]}`],
    [/^\/messages$/, () => '/(tabs)/messages'],
    [/^\/$/, () => '/(tabs)/home'],
  ];
  for (const [pattern, to] of rules) {
    const found = path.match(pattern);
    if (found) return to(found);
  }
  return null;
}

/** Opens website links that reach the app (Android App Links) on the matching screen. */
export function useAppLinks() {
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const route = routeForUrl(url);
      if (route) router.push(route as Href);
    };
    Linking.getInitialURL().then(handle).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => subscription.remove();
  }, []);
}
