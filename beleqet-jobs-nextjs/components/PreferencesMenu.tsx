"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe } from "lucide-react";
import { useTranslation, type SupportedLocale } from "@/lib/i18n";
import { useTheme } from "@/components/ThemeProvider";
import type { ThemePreference } from "@/lib/theme";

/**
 * Language and theme in one header control, so the nav keeps a single
 * settings entry point on every screen size.
 */
export default function PreferencesMenu() {
  const { t, locale, setLocale } = useTranslation();
  const { preference, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const languages: { id: SupportedLocale; label: string }[] = [
    { id: "en", label: "English" },
    { id: "am", label: "አማርኛ" },
  ];
  const themes: { id: ThemePreference; label: string }[] = [
    { id: "light", label: t("prefs.light") },
    { id: "dark", label: t("prefs.dark") },
    { id: "system", label: t("prefs.system") },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("prefs.label")}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-white/20 px-2.5 text-[13px] font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-limeAccent"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span>{locale === "am" ? "አማ" : "EN"}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 flex w-[280px] flex-col gap-4 rounded-xl border border-border bg-white p-4 text-ink shadow-[0_16px_40px_rgba(4,22,3,0.28)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <Segmented
            label={t("prefs.language")}
            options={languages}
            value={locale}
            onChange={(id) => setLocale(id)}
          />
          <Segmented
            label={t("prefs.theme")}
            options={themes}
            value={preference}
            onChange={(id) => setTheme(id)}
          />
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-[0.04em] text-muted dark:text-slate-400">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="grid rounded-md bg-[#F0F2EE] p-[3px] dark:bg-slate-800"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.id)}
              className={`min-h-10 rounded-[6px] px-2 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandGreen ${
                active
                  ? "bg-primary text-white dark:bg-limeAccent dark:text-primary"
                  : "text-ink-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
