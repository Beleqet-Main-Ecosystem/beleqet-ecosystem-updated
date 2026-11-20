export type SignInMethod = 'PASSWORD' | 'GOOGLE' | 'LINKEDIN' | 'TELEGRAM';

/** The ways this account can sign in today, worked out from the account itself. */
export function signInMethods(account: {
  passwordHash: string | null;
  telegramId: string | null;
  oauthAccounts: { provider: string }[];
}): SignInMethod[] {
  const methods: SignInMethod[] = [];
  if (account.passwordHash) methods.push('PASSWORD');
  for (const provider of ['GOOGLE', 'LINKEDIN'] as const) {
    if (account.oauthAccounts.some((link) => link.provider === provider)) methods.push(provider);
  }
  if (account.telegramId) methods.push('TELEGRAM');
  return methods;
}
