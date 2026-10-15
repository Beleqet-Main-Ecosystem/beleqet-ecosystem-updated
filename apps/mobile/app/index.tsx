import { Redirect } from 'expo-router';

/**
 * Root index — redirects to the main tabs.
 * This prevents an "Unmatched Route" error when the app
 * mounts at "/" (e.g. from a deep link or cold start).
 */
export default function Index() {
  return <Redirect href="/(tabs)/jobs" />;
}
