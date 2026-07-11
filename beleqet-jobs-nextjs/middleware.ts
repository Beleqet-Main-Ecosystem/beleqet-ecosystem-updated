import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale, type Locale } from "./i18n/config";

/**
 * Resolve the active locale from the incoming request.
 *
 * Resolution order:
 * 1. `NEXT_LOCALE` cookie — set explicitly by `LanguageSwitcher`.
 * 2. `Accept-Language` header — browser preference (first matching tag).
 * 3. `defaultLocale` (`"en"`) — final fallback.
 *
 * @param request - The incoming Next.js request.
 * @returns The resolved locale code.
 */
function resolveLocale(request: NextRequest): Locale {
  const cookie = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookie && locales.includes(cookie as Locale)) return cookie as Locale;

  const acceptLang = request.headers.get("accept-language") ?? "";
  for (const segment of acceptLang.split(",")) {
    const tag = segment.split(";")[0].trim().toLowerCase().slice(0, 2);
    if (locales.includes(tag as Locale)) return tag as Locale;
  }

  return defaultLocale;
}

/**
 * Locale detection middleware.
 *
 * Runs on every page request (excluding static assets and API routes).
 * Detects the user's locale via cookie or browser header, then writes it
 * back as the `NEXT_LOCALE` cookie (1-year TTL) so the server-side
 * `getRequestConfig` in `i18n/request.ts` can read it on each render.
 *
 * This approach keeps all existing routes (`/jobs`, `/pricing`, etc.)
 * intact without requiring an `app/[locale]/` directory structure.
 *
 * @param request - The incoming Next.js middleware request.
 * @returns The response with the `NEXT_LOCALE` cookie set.
 */
export function middleware(request: NextRequest) {
  const locale = resolveLocale(request);
  const response = NextResponse.next();

  response.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });

  return response;
}

/** Middleware matcher — runs on all routes except Next.js internals and static assets. */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon\\.svg|robots\\.txt|sitemap\\.xml|api/).*)",
  ],
};
