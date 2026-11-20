import { signInMethods } from './sign-in-methods';

describe('signInMethods', () => {
  it('lists every way into the account', () => {
    expect(
      signInMethods({
        passwordHash: 'hash',
        telegramId: '42',
        oauthAccounts: [{ provider: 'LINKEDIN' }, { provider: 'GOOGLE' }],
      }),
    ).toEqual(['PASSWORD', 'GOOGLE', 'LINKEDIN', 'TELEGRAM']);
  });

  it('a Telegram-only account signs in with Telegram alone', () => {
    expect(signInMethods({ passwordHash: null, telegramId: '42', oauthAccounts: [] })).toEqual([
      'TELEGRAM',
    ]);
  });
});
