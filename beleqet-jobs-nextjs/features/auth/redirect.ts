import type { AuthUser } from '@/lib/auth';

/**
 * Where to go after signing in, from a `?next=` value. Only same-site paths
 * are allowed: "//evil.example" and "/\evil.example" start with "/" but
 * browsers treat them as other sites, which would make sign-in links usable
 * for phishing redirects.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value: string;
  try {
    value = decodeURIComponent(raw).trim();
  } catch {
    return null;
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

/** Each role's home after signing in when no `next` was given. */
export function homeFor(user: Pick<AuthUser, 'role'>): string {
  switch (user.role) {
    case 'EMPLOYER':
      return '/employer';
    case 'ADMIN':
      return '/admin';
    default:
      return '/dashboard';
  }
}
