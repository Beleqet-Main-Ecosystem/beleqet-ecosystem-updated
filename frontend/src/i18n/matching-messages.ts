/** Keys used by the AI Matchmaker dashboard and kept separate from component markup. */
export type MatchingMessageKey =
  | 'matching.title'
  | 'matching.minScoreLabel'
  | 'matching.rescore'
  | 'matching.noMatches'
  | 'matching.loadError'
  | 'matching.tryAgain'
  | 'matching.skills'
  | 'matching.location'
  | 'matching.experience';

/** Currently shipped UI locales; new locale bundles can be added without changing components. */
export type SupportedLocale = 'en' | 'am';

const matchingMessages: Record<SupportedLocale, Record<MatchingMessageKey, string>> = {
  en: {
    'matching.title': 'AI Matchmaker',
    'matching.minScoreLabel': 'Minimum match score',
    'matching.rescore': 'Rescore',
    'matching.noMatches': 'No freelancers score at or above {minScore}% yet. Lower the threshold or check back once more freelancers join.',
    'matching.loadError': "Couldn't load matches",
    'matching.tryAgain': 'Try again',
    'matching.skills': 'Skills',
    'matching.location': 'Location',
    'matching.experience': 'Experience',
  },
  am: {
    'matching.title': 'የ AI ማዛመጃ',
    'matching.minScoreLabel': 'ዝቅተኛ የማዛመጃ ውጤት',
    'matching.rescore': 'እንደገና አስላ',
    'matching.noMatches': 'እስካሁን ከ{minScore}% በላይ ውጤት ያመጣ ባለሙያ የለም። ገደቡን ይቀንሱ ወይም ተጨማሪ ባለሙያዎች እስኪቀላቀሉ ይጠብቁ።',
    'matching.loadError': 'ማዛመጃዎችን መጫን አልተቻለም',
    'matching.tryAgain': 'እንደገና ይሞክሩ',
    'matching.skills': 'ክህሎቶች',
    'matching.location': 'አካባቢ',
    'matching.experience': 'ልምድ',
  },
};

/**
 * Returns a translated Matchmaker label with English as the stable fallback.
 *
 * @param locale - requested document locale
 * @param key - extractable message key
 * @param vars - optional `{token}` substitutions applied to the resolved string
 */
export function translateMatchingMessage(
  locale: string,
  key: MatchingMessageKey,
  vars?: Record<string, string | number>,
): string {
  const supportedLocale: SupportedLocale = locale === 'am' ? 'am' : 'en';
  let message = matchingMessages[supportedLocale][key];

  if (vars) {
    for (const [token, value] of Object.entries(vars)) {
      message = message.replace(`{${token}}`, String(value));
    }
  }

  return message;
}