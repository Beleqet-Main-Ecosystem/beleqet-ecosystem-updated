import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

/**
 * next-intl server-side request configuration.
 *
 * Called automatically by next-intl on every server request to determine
 * the active locale and load the corresponding message bundle.
 *
 * Locale resolution order:
 * 1. Read the `NEXT_LOCALE` cookie written by `middleware.ts`.
 * 2. Fall back to `defaultLocale` (`"en"`) if the cookie is absent or invalid.
 *
 * The loaded messages are passed to `NextIntlClientProvider` in `layout.tsx`
 * so client components can also call `useTranslations`.
 *
 * @returns `{ locale, messages }` consumed by next-intl internally.
 */
export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const raw = cookieStore.get("NEXT_LOCALE")?.value;

  const locale: Locale =
    raw && locales.includes(raw as Locale) ? (raw as Locale) : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
