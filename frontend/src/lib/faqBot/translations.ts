export type Locale = 'en' | 'am';
export type Currency = 'ETB' | 'USD' | 'EUR';

/**
 * Localized UI strings for the FAQ Bot widget (English + Amharic).
 */
export const translations = {
  en: {
    title: 'Beleqet FAQ Bot',
    subtitle: 'AI assistant for jobs, freelance, escrow & wallet questions',
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
    title: 'የበልቀት FAQ ቦት',
    subtitle: 'ስለ ስራ፣ ፍሪላንስ፣ ኤስክሮ እና ዋሌት ጥያቄዎች AI ረዳት',
    consentTitle: 'ግላዊነት እና የውሂብ አጠቃቀም (GDPR)',
    consentBody:
      'ድጋፍን ለማሻሻል የውይይት መልእክቶችዎን እስከ 90 ቀናት እናስቀምጣለን። ውሂብዎን በማንኛውም ጊዜ በ FAQ Bot API በኩል መላክ ወይም መሰረዝ ይችላሉ።',
    consentAccept: 'እስማማለሁ — ውይይት ጀምር',
    consentDecline: 'ሰርዝ',
    placeholder: 'ስለ ማውጣት፣ ኤስክሮ፣ ስራዎች ይጠይቁ...',
    send: 'ላክ',
    thinking: 'እያሰበ ነው...',
    openChat: 'FAQ ቦት ክፈት',
    closeChat: 'ዝጋ',
    language: 'ቋንቋ',
    currency: 'ገንዘብ',
    demoHint: 'ይሞክሩ፡ "ከዋሌቴ እንዴት ማውጣት እችላለሁ?"',
  },
} as const;

/**
 * Resolve a localized string for the given locale and key.
 * @param locale - Active UI locale
 * @param key - Translation key
 */
export function t(locale: Locale, key: keyof (typeof translations)['en']): string {
  return translations[locale][key];
}
