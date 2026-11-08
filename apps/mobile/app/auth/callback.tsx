import { Redirect } from 'expo-router';

/**
 * beleqet://auth/callback is caught by the sign-in browser session (lib/oauth.ts); if the system
 * opens it as a link instead, there is nothing to show here.
 */
export default function AuthCallback() {
  return <Redirect href="/(tabs)/home" />;
}
