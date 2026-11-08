import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { apiClient, persistTokens } from '../api/client';
import { fetchMe, type Me } from '../api/auth';
import { toApiError } from './api-error';
import { API_URL } from './config';

const RETURN_URL = 'beleqet://auth/callback';

export type ProviderResult =
  | { status: 'signed-in'; user: Me }
  | { status: 'needs-code'; tempToken: string }
  /** The email already has a password account; the API emailed a link to connect Google. */
  | { status: 'confirm' };

function base64Url(base64: string) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Google or LinkedIn sign-in in an in-app browser. The app keeps a one-time secret and sends only
 * its SHA-256 hash; the API answers through beleqet:// with a single-use code that is worth nothing
 * without the secret, so another app that grabbed the redirect couldn't sign in with it.
 * Resolves null when the person closed the browser.
 */
export async function signInWithProvider(provider: 'google' | 'linkedin'): Promise<ProviderResult | null> {
  const verifier = Array.from(Crypto.getRandomBytes(32), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const challenge = base64Url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }));
  const start = `${API_URL}/auth/${provider}?app_challenge=${encodeURIComponent(challenge)}`;

  const result = await WebBrowser.openAuthSessionAsync(start, RETURN_URL);
  if (result.type !== 'success') return null;

  const query = new URLSearchParams(result.url.split('?')[1]?.split('#')[0] ?? '');
  if (query.get('confirm')) return { status: 'confirm' };
  const twoFactor = query.get('twoFactor');
  if (twoFactor) return { status: 'needs-code', tempToken: twoFactor };
  const code = query.get('code');
  if (!code) throw new Error(query.get('error') || 'oauth-failed');

  try {
    const { data } = await apiClient.post<{ accessToken: string; refreshToken: string }>('/auth/app-exchange', { code, verifier });
    await persistTokens(data.accessToken, data.refreshToken);
    return { status: 'signed-in', user: await fetchMe() };
  } catch (error) {
    throw toApiError(error);
  }
}
