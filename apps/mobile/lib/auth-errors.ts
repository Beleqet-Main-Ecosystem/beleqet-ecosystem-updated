import { OFFLINE, toApiError } from './api-error';

/**
 * Sign-in messages from the API are English and technical; map the common ones to the website's
 * plain, translated text (same rules as SignInForm's `friendly`).
 */
export function authError(error: unknown, t: (key: string) => string): string {
  const failure = toApiError(error);
  if (failure.status === OFFLINE) return t('auth.errNetwork');
  if (failure.status === 429) return t('auth.errTooMany');
  const message = failure.serverMessage ?? '';
  if (/social login/i.test(message)) return t('auth.errSocial');
  if (/not right or has expired/i.test(message)) return t('auth.emailCodeWrong');
  if (/too many wrong codes/i.test(message)) return t('auth.emailCodeTooMany');
  if (/code screen has expired/i.test(message)) return t('auth.emailCodeExpired');
  if (/6-digit code/i.test(message)) return t('auth.emailCodeFormat');
  if (/invalid credentials|unauthorized|incorrect|wrong password/i.test(message)) return t('auth.errCredentials');
  if (/invalid code|expired verification|invalid or expired token/i.test(message)) return t('auth.errCode');
  if (/already registered/i.test(message)) return t('auth.errExists');
  if (/too many|throttl/i.test(message)) return t('auth.errTooMany');
  if (/deactivated|disabled|inactive/i.test(message)) return t('auth.errDisabled');
  if (failure.status === 401) return t('auth.errCredentials');
  return (failure.status >= 400 && failure.status < 500 && message) || t('auth.errGeneric');
}
