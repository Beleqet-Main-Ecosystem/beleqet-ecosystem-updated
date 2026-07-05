/**
 * @module components/mobile/GdprConsentBanner
 * @description GDPR-compliant cookie consent banner shown to users
 *   who have not yet recorded their preference.  The banner is
 *   dismissed by accepting all cookies, rejecting optional cookies,
 *   or customising preferences.
 *
 *   The user's choice is persisted in `localStorage` so the banner
 *   does not reappear.  A `data-consent` attribute is set on the
 *   `<html>` element to signal downstream analytics scripts.
 *
 *   This component only renders on the client side (uses `"use client"`)
 *   and lazily appears after a short delay to avoid layout shift.
 *
 * @example
 * ```tsx
 * // In layout.tsx, after main content:
 * <GdprConsentBanner />
 * ```
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

/** localStorage key for the user's GDPR consent choice. */
const CONSENT_STORAGE_KEY = "beleqet_gdpr_consent";

/**
 * Possible consent states stored in localStorage.
 *
 * - `"accepted"` — User accepted all cookies.
 * - `"rejected"` — User rejected optional (analytics) cookies.
 * - `"custom"`  — User chose custom preferences (future extension).
 */
type ConsentChoice = "accepted" | "rejected" | "custom";

/**
 * Reads the stored GDPR consent value, returning `null` if unset.
 *
 * @returns The stored consent string or `null`.
 */
function getStoredConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
  if (raw === "accepted" || raw === "rejected" || raw === "custom") return raw;
  return null;
}

/**
 * Persists the consent choice and updates the `data-consent` attribute
 * on the `<html>` element so analytics scripts can respect the choice.
 *
 * @param choice - The user's consent selection.
 */
function persistConsent(choice: ConsentChoice): void {
  localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  document.documentElement.setAttribute("data-consent", choice);
}

/**
 * GDPR cookie-consent banner for the mobile dashboard module.
 *
 * Behaviour:
 * - Checks localStorage on mount; does not render if a choice exists.
 * - Slides up from the bottom after a 500ms delay.
 * - Provides three actions: Accept All, Reject Optional, and a close
 *   icon that defaults to "reject" for simplicity.
 * - Sets `data-consent` attribute on `<html>` for analytics scripts.
 *
 * @returns The rendered consent banner, or `null` if consent already given.
 */
export default function GdprConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    const existing = getStoredConsent();
    if (existing) {
      /* Respect previously stored consent. */
      document.documentElement.setAttribute("data-consent", existing);
      setDismissed(true);
      return;
    }
    /* Delay appearance to avoid layout shift. */
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Handles the user's consent choice.
   *
   * @param choice - The selected consent level.
   */
  const handleChoice = useCallback((choice: ConsentChoice) => {
    persistConsent(choice);
    setShowSaved(true);
    setTimeout(() => {
      setVisible(false);
      setDismissed(true);
    }, 1500);
  }, []);

  if (dismissed) return null;

  return (
    <div
      role="dialog"
      aria-label={t("gdpr.title")}
      className={`
        fixed bottom-20 left-0 right-0 z-50 p-4
        transition-transform duration-300
        lg:bottom-4
        ${visible ? "translate-y-0" : "translate-y-[200%]"}
      `}
    >
      <div className="mx-auto max-w-lg rounded-2xl border border-primary/10 bg-white p-5 shadow-xl">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brandGreen/10 text-brandGreen">
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-primary">
              {t("gdpr.title")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {t("gdpr.description")}
            </p>
          </div>
          <button
            onClick={() => handleChoice("rejected")}
            aria-label="Dismiss"
            className="shrink-0 text-muted hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Action buttons */}
        {showSaved ? (
          <p className="mt-3 text-center text-xs font-semibold text-brandGreen">
            {t("gdpr.saved")}
          </p>
        ) : (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleChoice("accepted")}
              className="flex-1 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-white active:scale-[0.97] transition-transform"
            >
              {t("gdpr.acceptAll")}
            </button>
            <button
              onClick={() => handleChoice("rejected")}
              className="flex-1 rounded-xl border border-border px-4 py-3 text-xs font-bold text-ink active:scale-[0.97] transition-transform"
            >
              {t("gdpr.rejectOptional")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}