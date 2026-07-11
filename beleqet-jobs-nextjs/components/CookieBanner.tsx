"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "beleqet-cookie-consent";
const CONSENT_VERSION = 1;

type Consent = {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
  version: number;
};

const defaultConsent = {
  essential: true,
  analytics: false,
  marketing: false,
};

function isValidConsent(value: unknown): value is Consent {
  if (!value || typeof value !== "object") return false;

  const cons = value as Record<string, unknown>;
  return (
    cons.essential === true &&
    typeof cons.timestamp === "string" &&
    typeof cons.version === "number" &&
    cons.version === CONSENT_VERSION
  );
}

export default function CookieBanner() {
  const t = useTranslations("gdpr");
  const [isVisible, setIsVisible] = useState(true);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState(defaultConsent);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setIsVisible(true);
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (isValidConsent(parsed)) {
        setPreferences({
          essential: true,
          analytics: parsed.analytics === true,
          marketing: parsed.marketing === true,
        });
        setIsVisible(false);
        return;
      }
    } catch {
      // Ignore malformed storage values and show the banner.
    }

    setIsVisible(true);
  }, []);

  const saveConsent = (nextPreferences: typeof defaultConsent) => {
    const payload: Consent = {
      ...nextPreferences,
      timestamp: new Date().toISOString(),
      version: CONSENT_VERSION,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setPreferences(nextPreferences);
    setIsVisible(false);
  };

  const analyticsToggleLabel = useMemo(() => `${t("analyticsLabel")}`, [t]);
  const marketingToggleLabel = useMemo(() => `${t("marketingLabel")}`, [t]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-xl"
    >
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("body")}</p>
        </div>

        {!showPreferences ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
              onClick={() => saveConsent({ essential: true, analytics: true, marketing: true })}
            >
              {t("acceptAll")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
              onClick={() => saveConsent({ essential: true, analytics: false, marketing: false })}
            >
              {t("essentialOnly")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
              onClick={() => setShowPreferences(true)}
            >
              {t("managePreferences")}
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] p-3">
            <h3 className="text-base font-semibold">{t("prefsHeading")}</h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{t("essentialLabel")}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{t("essentialDesc")}</p>
                </div>
                <span className="rounded-full bg-[var(--color-muted)] px-2 py-1 text-xs">
                  {t("essentialLabel")}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{t("analyticsLabel")}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{t("analyticsDesc")}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.analytics}
                  aria-label={analyticsToggleLabel}
                  className="rounded-full border px-3 py-1 text-sm"
                  onClick={() =>
                    setPreferences((current) => ({
                      ...current,
                      analytics: !current.analytics,
                    }))
                  }
                >
                  {preferences.analytics ? "On" : "Off"}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{t("marketingLabel")}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{t("marketingDesc")}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.marketing}
                  aria-label={marketingToggleLabel}
                  className="rounded-full border px-3 py-1 text-sm"
                  onClick={() =>
                    setPreferences((current) => ({
                      ...current,
                      marketing: !current.marketing,
                    }))
                  }
                >
                  {preferences.marketing ? "On" : "Off"}
                </button>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
                  onClick={() => {
                    setShowPreferences(false);
                    setPreferences(defaultConsent);
                  }}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
                  onClick={() => {
                    setShowPreferences(false);
                    saveConsent(preferences);
                  }}
                >
                  {t("save")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
