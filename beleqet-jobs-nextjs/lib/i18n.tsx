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
      minimumFractionDigits: currency === "ETB" ? 2 : 2,
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
 */
const am: TranslationDictionary = {
  /* Navigation */
  "nav.findJobs": "\u12e0\u1333\u1348\u12eb\u1275 \u12f0\u1235\u1293",
  "nav.employers": "\u1230\u1295\u120d\u12ad\u130b\u12ce \u12c8\u1208\u122d",
  "nav.cvMaker": "\u12e8 CV \u1325\u130d\u1333",
  "nav.pricing": "\u12e0\u12f5\u120d",
  "nav.about": "\u12a0\u1295\u1270\u12ce\u1295",
  "nav.dashboard": "\u12e0\u12ac\u130b\u12f5 \u12b8\u1303",
  "nav.profile": "\u1348\u1208\u1320\u1235",
  "nav.applications": "\u12e0\u1333\u1350\u121d\u1235\u1270\u12ce\u1295",
  "nav.employer": "\u1230\u1295\u120d\u12ad\u130b\u12ce",
  "nav.admin": "\u12a0\u12f2\u1275\u130b\u12ce\u1295",
  "nav.notifications": "\u12a0\u1290\u12ce\u1275\u12ed",
  "nav.savedJobs": "\u12eb\u12ed\u1232\u12c8\u1275 \u12f0\u1235\u1293",

  /* Dashboard */
  "dashboard.greeting": "\u12e5\u1293 \u1293\u12a0\u12f0\u121b\u127d",
  "dashboard.careerDashboard": "\u12e0\u1348\u1208\u12cd\u127d \u12e1\u12ac\u130b\u12f5\u12e9 \u12b8\u1303",
  "dashboard.hiringWorkspace": "\u12e0\u134b\u1308\u121d\u127d \u1235\u122b\u1228",
  "dashboard.adminPanel": "\u12a0\u12f2\u1275\u130b\u12ce\u1295 \u1218\u122d\u120d",
  "dashboard.recentActivity": "\u12a5\u1295\u121b \u1270\u1325\u1328\u130d\u12ee",
  "dashboard.quickActions": "\u1293\u12ce\u1291 \u1235\u1343\u1265\u121d\u1270\u12ce\u1295",
  "dashboard.noActivity": "\u12a5\u1295\u121b \u1270\u1325\u1328\u130d\u12ee \u12a0\u121d\u1295\u1218\u12cd\u12a0\u12cd \u12a0\u1295\u120b\u120d\u121d\u1295\u1362",
  "dashboard.viewAll": "\u12c8\u122d\u12ab\u1295 \u134b\u1235",

  /* Stats */
  "stat.totalJobs": "\u12a1\u1295\u122d \u12f0\u1235\u1293",
  "stat.published": "\u12cb\u12a3\u12eb\u121d\u1295",
  "stat.applications": "\u1333\u1350\u121d\u1235\u1270\u12ce\u1295",
  "stat.saved": "\u12eb\u12ed\u1232\u12c8\u1275",
  "stat.interviews": "\u12a0\u1290\u134c\u1235\u12eb",
  "stat.offers": "\u12a0\u1348\u122b\u1235\u1270\u12ce\u1295",

  /* Quick Actions */
  "action.findJobs": "\u12f0\u1235\u1293 \u134b\u1235",
  "action.myApplications": "\u12e0\u1290\u1295 \u1333\u1350\u121d\u1235\u1270\u12ce\u1295",
  "action.postJob": "\u12f0\u1235 \u122b\u12cc\u12c8",
  "action.hiringDashboard": "\u12e0\u134b\u1308\u121d\u127d \u12e1\u12ac\u130b\u12f5",
  "action.findGigs": "\u12f0\u1235 \u134b\u1235",
  "action.myBids": "\u12e0\u1290\u1295 \u12a8\u12a1\u12ce\u1295",
  "action.browseJobs": "\u12f0\u1235\u1293 \u12a0\u12ad\u1263\u12c8",
  "action.editProfile": "\u1348\u1208\u1320\u1235 \u12a0\u1260\u1295\u12cb\u122d",

  /* GDPR */
  "gdpr.title": "\u12e0\u1218\u130d\u120b\u12a0\u1235\u1295 \u1218\u1208\u1235\u1270\u12ce\u1295",
  "gdpr.description":
    "\u12e0\u1343\u130d\u1275\u1295 \u1218\u122d\u120d\u1295\u1295 \u12a5\u1295\u122d \u12b8\u122d\u1308\u1295\u12cc\u12cd \u12a0\u12cb\u1308\u122d\u1295\u1295 \u12a8\u134c\u1295\u12aa\u129b\u1275\u12ed\u1295 \u12a8\u12e8\u1355\u12a0\u12ad \u12cb\u1308\u122b\u12a0\u123b\u127d \u12eb\u12f0\u1235\u122b\u12a0\u123b\u127d\u1295\u1295 \u1218\u122b\u12c8\u12a5\u121b\u1270\u12ce\u1295 \u1218\u1208\u1293\u121d\u1295 \u12a0\u12f0\u1265\u121b\u122d \u12a0\u1293\u12a5\u120b\u120d\u1295 \u12a5\u1293\u12a0\u12f0\u1260\u12bd\u1295 \u12a5\u1295\u1270\u12ee\u122a\u120b\u12a0\u123b\u127d \u12a0\u12ab\u1293\u1275\u1366",
  "gdpr.acceptAll": "\u12c8\u122d\u12ab\u1295\u1295 \u1235\u1235\u1293\u122d",
  "gdpr.rejectOptional": "\u12a0\u1348\u1218\u120b\u12a0\u1235\u1295\u1295 \u1235\u12ce\u12eb",
  "gdpr.customize": "\u12a0\u1260\u1295\u12cb\u122d",
  "gdpr.saved": "\u12e0\u1218\u1208\u1235\u1270\u12ce\u1295\u1295 \u1343\u121d\u12ca\u122b\u12c8\u1366",

  /* Common */
  "common.loading": "\u12eb\u1328\u1291\u2026",
  "common.error": "\u12a5\u1235\u121b\u12ce \u1330\u12a5\u12c8\u1263\u1275\u1295\u1295 \u12a0\u1308\u1228\u12cc\u12cd",
  "common.retry": "\u12a0\u1290\u12ab\u1235 \u1235\u12f3\u12ad",
  "common.noData": "\u12a0\u1328\u12cb\u12cd \u12a0\u1295\u120b\u120d\u121d\u1295 \u12a0\u1218\u1295\u1208\u1263\u12a0\u123b\u127d \u12a0\u1295\u120b\u120d\u121d\u1295 \u12a0\u121d\u1295\u1218\u12cd\u12a0\u12cd\u1366",
  "common.signIn": "\u12e0\u12ac\u130b\u12f5\u12e9 \u12b8\u1303\u1295 \u12a5\u1295\u1260\u121b\u122d \u12f0\u1235\u122b\u120d\u1295\u1295 \u12cb\u1235\u1293\u122d\u1295\u1366",
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