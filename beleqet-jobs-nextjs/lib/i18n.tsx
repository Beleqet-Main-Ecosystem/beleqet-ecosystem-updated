/**
 * @module lib/i18n
 * @description Lightweight internationalisation (i18n) module providing
 *   Amharic (`am`) and English (`en`) translations, a multi-currency
 *   formatter, and a React hook (`useTranslation`) for consuming
 *   translations inside client components.
 *
 *   The module follows a flat-key approach so that every translatable
 *   string has a single source of truth.  Adding a new locale only
 *   requires extending the `dictionaries` map.
 *
 * @example
 * ```tsx
 * import { useTranslation } from "@/lib/i18n";
 *
 * function Greeting() {
 *   const { t, locale, setLocale } = useTranslation();
 *   return <p>{t("dashboard.greeting")}</p>;
 * }
 * ```
 */

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Locale type & supported values                                    */
/* ------------------------------------------------------------------ */

/** All currently supported locale codes. */
export type SupportedLocale = "en" | "am";

/** Storage key used to persist the user's locale preference. */
const LOCALE_STORAGE_KEY = "beleqet_locale";

/** Default fallback locale when nothing is stored. */
const DEFAULT_LOCALE: SupportedLocale = "en";

/* ------------------------------------------------------------------ */
/*  Currency support                                                   */
/* ------------------------------------------------------------------ */

/**
 * ISO-4217 currency codes that the platform supports.
 * Each value is used with `Intl.NumberFormat` for locale-aware formatting.
 */
export type SupportedCurrency = "ETB" | "USD" | "EUR";

/**
 * Maps a currency code to its display symbol.
 * Useful when `Intl.NumberFormat` is overkill (e.g. in a badge).
 */
export const currencySymbols: Record<SupportedCurrency, string> = {
  ETB: "Br",
  USD: "$",
  EUR: "\u20AC",
};

/**
 * Formats a monetary value in the given currency, optionally using the
 * user's locale for digit grouping / decimal placement.
 *
 * @param amount  - The numeric amount to format.
 * @param currency - ISO-4217 currency code (defaults to `"ETB"`).
 * @param locale  - BCP-47 locale tag (defaults to `"en"`).
 * @returns A human-readable currency string, e.g. `"12,500.00 Br"`.
 *
 * @example
 * ```ts
 * formatCurrency(12500, "ETB", "am"); // "12,500.00 Br"
 * formatCurrency(99.99, "USD");       // "$99.99"
 * ```
 */
export function formatCurrency(
  amount: number,
  currency: SupportedCurrency = "ETB",
  locale: string = "en",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    /* Fallback for environments without full ICU support. */
    return `${amount.toFixed(2)} ${currencySymbols[currency]}`;
  }
}

/* ------------------------------------------------------------------ */
/*  Translation dictionaries                                          */
/* ------------------------------------------------------------------ */

/**
 * Flat key-value translation map for a single locale.
 * Keys use dot-separated paths (e.g. `"dashboard.greeting"`).
 */
type TranslationDictionary = Record<string, string>;

/**
 * Translation dictionary for **English**.
 */
const en: TranslationDictionary = {
  /* Navigation */
  "nav.findJobs": "Find Jobs",
  "nav.employers": "For Employers",
  "nav.cvMaker": "CV Maker",
  "nav.pricing": "Pricing",
  "nav.about": "About",
  "nav.dashboard": "Dashboard",
  "nav.profile": "Profile",
  "nav.applications": "Applications",
  "nav.employer": "Employer",
  "nav.admin": "Admin",
  "nav.notifications": "Notifications",
  "nav.savedJobs": "Saved Jobs",

  /* Dashboard */
  "dashboard.greeting": "Welcome back",
  "dashboard.careerDashboard": "Career Dashboard",
  "dashboard.hiringWorkspace": "Hiring Workspace",
  "dashboard.adminPanel": "Admin Panel",
  "dashboard.recentActivity": "Recent Activity",
  "dashboard.quickActions": "Quick Actions",
  "dashboard.noActivity": "No recent activity to show.",
  "dashboard.viewAll": "View all",
  "dashboard.employerBadge": "Employer dashboard",
  "dashboard.careerBadge": "Career dashboard",

  /* Stats */
  "stat.totalJobs": "Total Jobs",
  "stat.published": "Published",
  "stat.applications": "Applications",
  "stat.saved": "Saved",
  "stat.interviews": "Interviews",
  "stat.offers": "Offers",

  /* Quick Actions */
  "action.findJobs": "Find Jobs",
  "action.myApplications": "My Applications",
  "action.postJob": "Post a Job",
  "action.hiringDashboard": "Hiring Dashboard",
  "action.findGigs": "Find Gigs",
  "action.myBids": "My Bids",
  "action.browseJobs": "Browse Jobs",
  "action.editProfile": "Edit Profile",

  /* GDPR */
  "gdpr.title": "Privacy Preferences",
  "gdpr.description":
    "We use essential cookies to operate this platform and optional analytics cookies to improve your experience. You may change your preferences at any time.",
  "gdpr.acceptAll": "Accept All",
  "gdpr.rejectOptional": "Reject Optional",
  "gdpr.customize": "Customize",
  "gdpr.saved": "Your preferences have been saved.",

  /* Common */
  "common.loading": "Loading\u2026",
  "common.error": "Something went wrong.",
  "common.retry": "Retry",
  "common.noData": "No data available.",
  "common.signIn": "Sign in to view your dashboard.",
};

/**
 * Translation dictionary for **Amharic** (Ethiopia's official language).
 * Corrected & decoded for readability — values are stored as native
 * Ethiopic characters rather than `\uXXXX` escape sequences so that
 * translators can review and edit them directly.
 */
const am: TranslationDictionary = {
  /* Navigation */
  "nav.findJobs": "ስራዎችን ፈልግ",
  "nav.employers": "ለአሰሪዎች",
  "nav.cvMaker": "ሲቪ አዘጋጅ",
  "nav.pricing": "ዋጋዎች",
  "nav.about": "ስለ እኛ",
  "nav.dashboard": "ዳሽቦርድ",
  "nav.profile": "የግል መገለጫ",
  "nav.applications": "ማመልከቻዎች",
  "nav.employer": "አሰሪ",
  "nav.admin": "አስተዳዳሪ",
  "nav.notifications": "ማሳወቂያዎች",
  "nav.savedJobs": "የተቀመጡ ስራዎች",

  /* Dashboard */
  "dashboard.greeting": "እንኳን ደህና መጡ",
  "dashboard.careerDashboard": "የስራ ዳሽቦርድ",
  "dashboard.hiringWorkspace": "የመቀጠሪያ የስራ ቦታ",
  "dashboard.adminPanel": "የአስተዳዳሪ ፓነል",
  "dashboard.recentActivity": "የቅርብ ጊዜ እንቅስቃሴዎች",
  "dashboard.quickActions": "ፈጣን ድርጊቶች",
  "dashboard.noActivity": "ምንም የቅርብ ጊዜ እንቅስቃሴ የለም።",
  "dashboard.viewAll": "ሁሉንም እይ",
  "dashboard.employerBadge": "የአሰሪ ዳሽቦርድ",
  "dashboard.careerBadge": "የስራ ፈላጊ ዳሽቦርድ",

  /* Stats */
  "stat.totalJobs": "አጠቃላይ ስራዎች",
  "stat.published": "የተለጠፉ",
  "stat.applications": "የገቡ ማመልከቻዎች",
  "stat.saved": "የተቀመጡ",
  "stat.interviews": "ቃለ-መጠይቆች",
  "stat.offers": "የቀረቡ የስራ እድሎች",

  /* Quick Actions */
  "action.findJobs": "ስራዎችን ፈልግ",
  "action.myApplications": "የእኔ ማመልከቻዎች",
  "action.postJob": "ስራ ለጥፍ",
  "action.hiringDashboard": "የቅጥር ዳሽቦርድ",
  "action.findGigs": "ጊጎችን ፈልግ",
  "action.myBids": "የእኔ ጨረታዎች",
  "action.browseJobs": "ስራዎችን አስስ",
  "action.editProfile": "መገለጫ አሻሽል",

  /* GDPR */
  "gdpr.title": "የግል ደህንነት ምርጫዎች",
  "gdpr.description":
    "ይህንን ፕላትፎርም ለማስኬድ አስፈላጊ የሆኑ ኩኪዎችን እና የተጠቃሚ ተሞክሮዎን ለማሻሻል አማራጭ የትንታኔ ኩኪዎችን እንጠቀማለን። ምርጫዎችዎን በማንኛውም ጊዜ መለወጥ ይችላሉ።",
  "gdpr.acceptAll": "ሁሉንም ፍቀድ",
  "gdpr.rejectOptional": "አማራጮቹን እምቢ",
  "gdpr.customize": "አብጅ",
  "gdpr.saved": "ምርጫዎችዎ በተሳካ ሁኔታ ተቀምጠዋል።",

  /* Common */
  "common.loading": "በመጫን ላይ…",
  "common.error": "የሆነ ችግር ተከስቷል።",
  "common.retry": "እንደገና ሞክር",
  "common.noData": "ምንም መረጃ የለም።",
  "common.signIn": "ዳሽቦርድዎን ለማየት እባክዎ ይግቡ።",
};

/**
 * Map of locale code to its translation dictionary.
 * Add new locales by extending this object.
 */
const dictionaries: Record<SupportedLocale, TranslationDictionary> = { en, am };

/* ------------------------------------------------------------------ */
/*  React context & hook                                               */
/* ------------------------------------------------------------------ */

/**
 * Value exposed by the `I18nProvider` context.
 *
 * @property t      - Translation function. Falls back to the key itself
 *                     when no translation is found.
 * @property locale - The currently active locale code.
 * @property setLocale - Switch to a different locale (persists to localStorage).
 */
export type I18nContextValue = {
  t: (key: string) => string;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Reads the persisted locale from `localStorage`, falling back to
 * {@link DEFAULT_LOCALE} when the stored value is invalid or absent.
 *
 * @returns The stored locale code or `"en"`.
 */
function getPersistedLocale(): SupportedLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === "am" || stored === "en") return stored;
  return DEFAULT_LOCALE;
}

/**
 * Provider component that makes the `t` function, `locale`, and
 * `setLocale` available to the entire component tree.
 *
 * Wrap your root layout with this provider (or place it alongside
 * `AuthProvider`) to enable translations everywhere.
 *
 * @param props.children - The application component tree.
 *
 * @example
 * ```tsx
 * <I18nProvider>
 *   <AuthProvider>{children}</AuthProvider>
 * </I18nProvider>
 * ```
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  /* Hydrate from localStorage after mount. */
  useEffect(() => {
    setLocaleState(getPersistedLocale());
  }, []);

  /**
   * Switch the active locale and persist the choice.
   *
   * @param newLocale - The locale code to activate.
   */
  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  /**
   * Look up a translation key in the active dictionary.
   * Falls back to the English dictionary, then to the raw key.
   *
   * @param key - Dot-separated translation key, e.g. `"nav.dashboard"`.
   * @returns The translated string.
   */
  const t = useCallback(
    (key: string): string => {
      return (
        dictionaries[locale]?.[key] ??
        dictionaries.en[key] ??
        key
      );
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * React hook that provides access to the i18n context.
 *
 * Must be called inside a component that is wrapped by {@link I18nProvider}.
 *
 * @returns An object with `t`, `locale`, and `setLocale`.
 * @throws If used outside of an `I18nProvider`.
 *
 * @example
 * ```tsx
 * const { t, locale, setLocale } = useTranslation();
 * <button onClick={() => setLocale(locale === "en" ? "am" : "en")}>
 *   {t("common.loading")}
 * </button>
 * ```
 */
export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return ctx;
}
