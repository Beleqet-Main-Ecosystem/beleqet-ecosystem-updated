export type Locale = 'en' | 'am';
export type Currency = 'ETB' | 'USD' | 'EUR';

export const translations = {
  en: {
    title: 'Beleqet FAQ Bot',
    subtitle: 'AI-powered assistant for jobs, freelance, escrow & wallet questions',
    consentTitle: 'Privacy & Data Use (GDPR)',
    consentBody:
      'We store your chat messages for up to 90 days to improve support. You can export or delete your data anytime via the FAQ Bot API.',
    consentAccept: 'I agree — start chat',
    consentDecline: 'Cancel',
    placeholder: 'Ask about withdrawals, escrow, jobs...',
    send: 'Send',
    thinking: 'Thinking...',
    openChat: 'Open FAQ Bot',
    closeChat: 'Close',
    language: 'Language',
    currency: 'Currency',
    demoHint: 'Try: "How do I withdraw from my wallet?"',
  },
  am: {
    title: 'Beleqet FAQ Bot',
    subtitle: 'AI-powered assistant for jobs, freelance, escrow & wallet questions',
    consentTitle: 'Privacy & Data Use (GDPR)',
    consentBody:
      'We store your chat messages for up to 90 days. You can export or delete your data anytime.',
    consentAccept: 'I agree — start chat',
    consentDecline: 'Cancel',
    placeholder: 'Ask about withdrawals, escrow, jobs...',
    send: 'Send',
    thinking: 'Thinking...',
    openChat: 'Open FAQ Bot',
    closeChat: 'Close',
    language: 'Language',
    currency: 'Currency',
    demoHint: 'Try: "How do I withdraw from my wallet?"',
  },
} as const;

export function t(locale: Locale, key: keyof (typeof translations)['en']): string {
  return translations[locale][key];
}
