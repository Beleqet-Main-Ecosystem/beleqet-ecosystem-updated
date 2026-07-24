"use client";

import type { LanguageCode } from "@/portfolio/types";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  locale: LanguageCode;
  onChange: (locale: LanguageCode) => void;
  label?: string;
};

/**
 * Toggles content editing language (English / Amharic).
 */
export function LanguageSwitcher({
  locale,
  onChange,
  label = "Content language",
}: LanguageSwitcherProps) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">
        {label}
      </span>
      {(["en", "am"] as LanguageCode[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold transition",
            locale === code
              ? "bg-primary text-white"
              : "bg-primary/5 text-ink/70 hover:bg-primary/10",
          )}
          aria-pressed={locale === code}
        >
          {code === "en" ? "English" : "አማርኛ"}
        </button>
      ))}
    </div>
  );
}
