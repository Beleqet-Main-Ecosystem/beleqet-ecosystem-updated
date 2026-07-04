import { ThemeLocale } from '../theme.types';

/**
 * Visible label strings for the theme toggle, keyed by locale.
 *
 * Scope note (Global Scaling requirement — i18n):
 * The wider Beleqet backend already has a dedicated `src/i18n` setup for
 * full server-driven translations. This module is frontend-only and was
 * scoped to "implement only the assigned module," so rather than pull in
 * a full i18n framework (e.g. `next-intl`) for three short strings, this
 * file plays the same role in miniature: no label is hardcoded inline in
 * a component, every string is looked up by locale, and swapping this
 * dictionary for `next-intl` later is a drop-in change, not a rewrite.
 */
export const THEME_LABELS: Record<
  ThemeLocale,
  { light: string; dark: string; system: string; toggleAriaLabel: string }
> = {
  en: {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    toggleAriaLabel: 'Toggle color theme',
  },
  am: {
    light: 'ብርሃን',
    dark: 'ጨለማ',
    system: 'ራስ-ሰር',
    toggleAriaLabel: 'የገጽ ገጽታ ቀይር',
  },
};

/**
 * Looks up the label set for a given locale, falling back to English if an
 * unsupported locale is passed in (defensive default, never throws).
 *
 * @param locale - The active UI locale.
 * @returns The label strings for that locale.
 */
export function getThemeLabels(locale: ThemeLocale): (typeof THEME_LABELS)['en'] {
  return THEME_LABELS[locale] ?? THEME_LABELS.en;
}
