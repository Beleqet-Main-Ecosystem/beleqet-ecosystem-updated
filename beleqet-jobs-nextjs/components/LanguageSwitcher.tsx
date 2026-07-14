"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { locales, type Locale } from "@/i18n/config";

/** Human-readable display label for each supported locale. */
const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  am: "አማርኛ",
};

/** Flag emoji for each supported locale. */
const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  am: "🇪🇹",
};

/**
 * Dropdown that lets the user switch the application language.
 *
 * Uses `localePrefix: "never"` strategy — the locale is stored in the
 * `NEXT_LOCALE` cookie and never reflected in the URL, so all existing
 * routes (`/jobs`, `/pricing`, etc.) remain unchanged.
 *
 * On change, the cookie is written and `router.refresh()` triggers a
 * server re-render with the new message bundle.
 *
 * Accessibility: uses a native `<select>` for full keyboard and
 * screen-reader support.
 *
 * @example
 * <LanguageSwitcher />
 */
export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  /**
   * Switch to the given locale by setting the NEXT_LOCALE cookie and
   * refreshing the current route.
   *
   * @param newLocale - The locale code to switch to (e.g. `"am"`).
   */
  const handleChange = (newLocale: Locale) => {
    if (newLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    router.refresh();
  };

  return (
    <div className="relative inline-flex items-center">
      <Globe
        className="pointer-events-none absolute left-2 h-4 w-4 text-[var(--color-text-muted)]"
        aria-hidden="true"
      />
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value as Locale)}
        aria-label="Select language"
        className={[
          "h-9 appearance-none rounded-xl pl-7 pr-3 text-sm font-semibold",
          "border border-[var(--color-border)]",
          "bg-[var(--color-bg-surface)] text-[var(--color-text)]",
          "transition-colors duration-200 cursor-pointer",
          "hover:border-brandGreen focus:outline-none focus:ring-2 focus:ring-brandGreen/40",
        ].join(" ")}
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {LOCALE_FLAGS[l]} {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
