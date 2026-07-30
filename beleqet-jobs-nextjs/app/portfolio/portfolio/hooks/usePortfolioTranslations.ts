"use client";

import { useCallback, useEffect, useState } from "react";
import type { LanguageCode } from "../types";
import { PORTFOLIO_LOCALE_KEY } from "../constants/storage";

const FALLBACK: Record<string, string> = {
  builderTitle: "Portfolio Builder",
  builderSubtitle: "Craft your master profile — one source for CVs, resumes, and applications.",
  templates: "Templates",
  preview: "Preview",
  save: "Save",
  export: "Export",
  publish: "Publish",
  saved: "Portfolio saved",
  published: "Portfolio published",
  authRequired: "Sign in to save, export, or publish your portfolio.",
  signIn: "Sign in",
  createAccount: "Create account",
  addProject: "Add project",
  addCaseStudy: "Add case study",
  addCertification: "Add certification",
  addExperience: "Add experience",
  addEducation: "Add education",
  addGallery: "Add image",
  addSocial: "Add link",
  featured: "Featured",
  dragHint: "Drag to reorder",
  contentLanguage: "Content language",
  selectIndustries: "Select industries",
  chooseTemplate: "Choose a template",
  startBuilding: "Start building",
  managePortfolio: "Manage portfolio",
  lastUpdated: "Last updated",
  openBuilder: "Open builder",
};

/**
 * Lightweight i18n hook for portfolio builder UI strings.
 * Follows the same self-contained pattern as `useFeedTranslations`.
 */
export function usePortfolioTranslations() {
  const [locale, setLocaleState] = useState<LanguageCode>("en");
  const [messages, setMessages] = useState<Record<string, string>>(FALLBACK);

  useEffect(() => {
    const stored = window.localStorage.getItem(PORTFOLIO_LOCALE_KEY);
    if (stored === "en" || stored === "am") setLocaleState(stored);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/locales/${locale}/portfolio.json`)
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("locale fetch failed")),
      )
      .then((data: Record<string, string>) => {
        if (!cancelled) setMessages({ ...FALLBACK, ...data });
      })
      .catch(() => {
        if (!cancelled) setMessages(FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const setLocale = useCallback((next: LanguageCode) => {
    setLocaleState(next);
    window.localStorage.setItem(PORTFOLIO_LOCALE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string) => messages[key] ?? FALLBACK[key] ?? key,
    [messages],
  );

  return { t, locale, setLocale };
}
