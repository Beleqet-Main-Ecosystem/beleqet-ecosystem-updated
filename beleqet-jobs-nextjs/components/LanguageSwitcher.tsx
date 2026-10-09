"use client";

import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-white/60 hover:bg-white/10 hover:text-white"
      onClick={() => setLocale(locale === "en" ? "am" : "en")}
      title="Toggle Language"
      aria-label={locale === "en" ? "Switch to Amharic" : "Switch to English"}
    >
      {locale === "en" ? "አማ" : "EN"}
    </Button>
  );
}
