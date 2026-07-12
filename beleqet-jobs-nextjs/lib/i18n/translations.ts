/**
 * @file translations.ts
 * @description
 * Translation strings for internationalization (i18n).
 * Supports English (en) and Amharic (am) languages.
 */

export const translations = {
  en: {
    theme: {
      light: 'Light',
      dark: 'Dark',
      system: 'System',
      toggleTheme: 'Toggle theme',
    },
    reviews: {
      writeReview: 'Write a Review',
      rating: 'Rating',
      yourReview: 'Your Review',
      submitReview: 'Submit Review',
      submitting: 'Submitting...',
      minimumChars: 'Minimum 10 characters',
      placeholder: 'Share your experience working with this freelancer...',
      reviewing: 'Reviewing:',
      selectRating: 'Please select a rating',
      commentTooShort: 'Please provide a comment with at least 10 characters',
      commentTooLong: 'Comment must be less than 1000 characters',
      submissionFailed: 'Failed to submit review. Please try again.',
      noReviews: 'No reviews yet',
      reviews: 'reviews',
      review: 'review',
      stars: 'stars',
      star: 'star',
    },
  },
  am: {
    theme: {
      light: 'ብርሃን',
      dark: 'ጨለማ',
      system: 'ሲስተም',
      toggleTheme: 'ቴማ ቀይር',
    },
    reviews: {
      writeReview: 'አስተያየት ይግለጹ',
      rating: 'ደረጃ',
      yourReview: 'የእርስዎ አስተያየት',
      submitReview: 'አስተያየት ላክ',
      submitting: 'በማስገባት ላይ...',
      minimumChars: 'አነስተኛ 10 ፊደላት',
      placeholder: 'ከዚህ ፍሪላንሰር ጋር ያጋሩትን ተሞክሮ ያካፍሉ...',
      reviewing: 'በመገመግ ላይ:',
      selectRating: 'እባክዎ ደረጃ ይምረጡ',
      commentTooShort: 'እባክዎ ቢያንስ 10 ፊደላት አስተያየት ይስጡ',
      commentTooLong: 'አስተያየቱ 1000 ፊደላት አልፎ መሆን አይችልም',
      submissionFailed: 'አስተያየት መላክ አልተቻለም። እባክዎ እንደገና ይሞክሩ።',
      noReviews: 'አስተያየቶች ገና የሉም',
      reviews: 'አስተያየቶች',
      review: 'አስተያየት',
      stars: 'ኮከቦች',
      star: 'ኮከብ',
    },
  },
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;
export type ThemeTranslationKey = keyof typeof translations.en.theme;
export type ReviewTranslationKey = keyof typeof translations.en.reviews;

/**
 * Get translation for a given language and key
 */
export function getTranslation(
  lang: Language,
  key: TranslationKey,
): any {
  return translations[lang][key] || translations.en[key];
}

/**
 * Get theme translation for a given language
 */
export function getThemeTranslation(
  lang: Language,
  key: ThemeTranslationKey,
): string {
  return translations[lang].theme[key] || translations.en.theme[key];
}

/**
 * Get review translation for a given language
 */
export function getReviewTranslation(
  lang: Language,
  key: ReviewTranslationKey,
): string {
  return translations[lang].reviews[key] || translations.en.reviews[key];
}
