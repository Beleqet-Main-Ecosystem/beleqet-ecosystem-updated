'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const LOCALE_STORAGE_KEY = 'beleqet_locale';
const DEFAULT_LOCALE = 'en';

const dictionaries = {
  en: {
    'nav.findJobs': 'Find Jobs',
    'nav.freelance': 'Freelance',
    'nav.forEmployers': 'For Employers',
    'nav.cvMaker': 'CV Maker',
    'nav.portfolio': 'Portfolio',
    'nav.chatToText': 'Chat to Text',
    'nav.pricing': 'Pricing',
    'nav.about': 'About',
    'nav.login': 'Login',
    'nav.signUp': 'Sign Up',
    'nav.postJob': 'Post a Job',
    'hero.badgeJobs': 'Jobs Marketplace',
    'hero.badgeGigs': 'Freelance Gigs',
    'hero.jobsH1': 'Find Your Next Opportunity Faster.',
    'hero.gigsH1': 'Get Your Next Project Paid Safely.',
    'hero.jobsSub': 'Discover thousands of verified job opportunities across Ethiopia. Search, apply, and get hired faster with the Beleqet Vacancy Platform.',
    'hero.gigsSub': 'Post projects to verified Ethiopian clients, get paid safely through escrow, and grow your freelance career with confidence.',
    'hero.searchPlaceholder': 'Job title, keyword or company',
    'hero.locationPlaceholder': 'Location e.g. Addis Ababa',
    'hero.searchBtn': 'Search Jobs',
    'hero.findTalentBtn': 'Find Talent',
    'hero.freshOpportunities': 'Fresh opportunities',
    'hero.exploreAll': 'Explore all openings →',
    'hero.verifiedEmployers': 'Verified employers',
    'stats.activeJobs': 'Active Jobs',
    'stats.companies': 'Hiring Companies',
    'stats.seekers': 'Job Seekers',
    'stats.satisfaction': 'Satisfaction',
  },
  am: {
    'nav.findJobs': 'ስራዎችን ፈልግ',
    'nav.freelance': 'ፍሪላንስ',
    'nav.forEmployers': 'ለአሰሪዎች',
    'nav.cvMaker': 'ሲቪ አዘጋጅ',
    'nav.portfolio': 'ፖርትፎሊዮ',
    'nav.chatToText': 'ቻት ቱ ቴክስት',
    'nav.pricing': 'ዋጋዎች',
    'nav.about': 'ስለ እኛ',
    'nav.login': 'ግባ',
    'nav.signUp': 'ተመዝገብ',
    'nav.postJob': 'ስራ ፖስት አድርግ',
    'hero.badgeJobs': 'የስራ ገበያ',
    'hero.badgeGigs': 'የፍሪላንስ ገበያ',
    'hero.jobsH1': 'የወደፊት የስራ እድልዎን በፍጥነት ያግኙ።',
    'hero.gigsH1': 'የፍሪላንስ ፕሮጀክትዎን በአስተማማኝ ሁኔታ ይስሩ።',
    'hero.jobsSub': 'በሺዎች የሚቆጠሩ የተረጋገጡ የስራ እድሎችን በኢትዮጵያ ውስጥ ያግኙ። በቀላሉ ይፈልጉ፣ ያመልክቱ እና ይቀጠሩ።',
    'hero.gigsSub': 'ክፍያ በ Escrow የተጠበቀ፣ ደንበኛ ወይም ፊሪላንሰርን በቀጥታ ያግኙ። አስተማማኝ የአገር ውስጥ ክፍያዎች።',
    'hero.searchPlaceholder': 'የስራ መጠሪያ፣ ሙያ ወይም ድርጅት',
    'hero.locationPlaceholder': 'አካባቢ ለምሳሌ አዲስ አበባ',
    'hero.searchBtn': 'ስራዎችን ፈልግ',
    'hero.findTalentBtn': 'ባለሙያ ፈልግ',
    'hero.freshOpportunities': 'አዳዲስ የስራ እድሎች',
    'hero.exploreAll': 'ሁሉንም ክፍት ስራዎች እይ →',
    'hero.verifiedEmployers': 'የተረጋገጡ አሰሪዎች',
    'stats.activeJobs': 'ክፍት ስራዎች',
    'stats.companies': 'ቀጣሪ ድርጅቶች',
    'stats.seekers': 'ስራ ፈላጊዎች',
    'stats.satisfaction': 'የእርካታ መጠን',
  },
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'am' || stored === 'en') {
      setLocaleState(stored);
      document.documentElement.lang = stored;
    }
  }, []);

  const setLocale = useCallback((newLocale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
      window.dispatchEvent(new Event('beleqet_locale_change'));
    }
  }, []);

  const t = useCallback(
    (key) => dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key,
    [locale],
  );

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      t: (key) => dictionaries.en[key] ?? key,
      locale: 'en',
      setLocale: () => {},
    };
  }
  return ctx;
}
