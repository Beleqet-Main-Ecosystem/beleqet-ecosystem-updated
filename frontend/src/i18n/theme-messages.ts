/** Keys used by the theme control and kept separate from component markup. */
export type ThemeMessageKey = 'theme.label' | 'theme.light' | 'theme.dark' | 'theme.system';

/** Currently shipped UI locales; new locale bundles can be added without changing components. */
export type SupportedLocale = 'en' | 'am';

const themeMessages: Record<SupportedLocale, Record<ThemeMessageKey, string>> = {
  en: {
    'theme.label': 'Theme',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.system': 'System',
  },
  am: {
    'theme.label': 'ገጽታ',
    'theme.light': 'ብርሃን',
    'theme.dark': 'ጨለማ',
    'theme.system': 'ስርዓት',
  },
};

/**
 * Returns a translated theme-control label with English as the stable fallback.
 *
 * @param locale - requested document locale
 * @param key - extractable message key
 * @returns translated label for the requested locale
 */
export function translateThemeMessage(locale: string, key: ThemeMessageKey): string {
  const supportedLocale: SupportedLocale = locale === 'am' ? 'am' : 'en';
  return themeMessages[supportedLocale][key];
}
