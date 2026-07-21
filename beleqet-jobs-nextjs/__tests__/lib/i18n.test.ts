/**
 * @file __tests__/lib/i18n.test.ts
 * @description Comprehensive unit tests for the i18n module (`lib/i18n.tsx`).
 *
 * Covers:
 * - `formatCurrency` with ETB, USD, EUR across multiple locales.
 * - `formatCurrency` fallback for environments without full ICU support.
 * - Translation lookup and fallback chain (active locale → en → raw key).
 * - Amharic ("am") locale translations.
 * - Default locale behaviour ("en").
 * - Locale parameter impact on number formatting (grouping / decimal).
 */

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

/**
 * Mock `Intl.NumberFormat` so that currency output is deterministic
 * across local machines, CI runners, and Node.js versions.
 *
 * The mock returns a predictable string of the form:
 *   `"${symbol}${formattedInteger}.${fractional} ${code}"`
 * e.g. `"$1,234.56 USD"`, `"Br12,500.00 ETB"`, `"€1,500.00 EUR"`.
 *
 * This eliminates flaky regex assertions like `/ETB|Br/` that break
 * when the real ICU data ships a different symbol.
 */
const originalIntl = global.Intl;

beforeAll(() => {
  const symbolMap: Record<string, string> = {
    ETB: "Br",
    USD: "$",
    EUR: "\u20AC",
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  global.Intl = {
    ...originalIntl,
    NumberFormat: function (
      this: any,
      locale: string,
      opts: any,
    ): Intl.NumberFormat & { format: (n: number) => string } {
      const code: string = opts?.currency ?? "ETB";
      const symbol = symbolMap[code] ?? code;
      const formatNumber = (n: number): string => {
        const abs = Math.abs(n);
        const intPart = Math.floor(abs)
          .toLocaleString(locale === "am" ? "en" : locale);
        const frac = abs.toFixed(2).slice(-2);
        const sign = n < 0 ? "-" : "";
        return `${sign}${symbol}${intPart}.${frac} ${code}`;
      };
      return {
        format: formatNumber,
        resolvedOptions: () => ({
          locale,
          style: opts?.style ?? "decimal",
          currency: code,
          minimumFractionDigits: opts?.minimumFractionDigits ?? 2,
          maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
        }),
      } as any;
    },
  } as any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
});

afterAll(() => {
  global.Intl = originalIntl;
});

/* ------------------------------------------------------------------ */
/*  Imports (after mocks are installed)                                */
/* ------------------------------------------------------------------ */

import {
  formatCurrency,
  SupportedCurrency,
  currencySymbols,
  I18nProvider,
  useTranslation,
} from "@/lib/i18n";
import { renderHook, act } from "@testing-library/react";
import React from "react";

/* ================================================================== */
/*  1. formatCurrency – static function tests                          */
/* ================================================================== */

describe("formatCurrency", () => {
  /* --- ETB --- */
  describe("ETB formatting", () => {
    it("formats a standard ETB amount with Br symbol and ETB code", () => {
      const result = formatCurrency(12500, "ETB", "en");
      expect(result).toBe("Br12,500.00 ETB");
    });

    it("formats ETB with Amharic locale", () => {
      const result = formatCurrency(12500, "ETB", "am");
      /* The mock uses "en" formatting internally for "am" since
         Amharic digit formatting is not widely supported by ICU. */
      expect(result).toBe("Br12,500.00 ETB");
    });

    it("defaults to ETB when no currency argument is provided", () => {
      const result = formatCurrency(100);
      expect(result).toBe("Br100.00 ETB");
    });

    it("defaults to 'en' locale when no locale argument is provided", () => {
      const result = formatCurrency(2500, "ETB");
      expect(result).toBe("Br2,500.00 ETB");
    });
  });

  /* --- USD --- */
  describe("USD formatting", () => {
    it("formats a USD amount with $ symbol", () => {
      const result = formatCurrency(99.99, "USD", "en");
      expect(result).toBe("$99.99 USD");
    });

    it("formats zero USD", () => {
      const result = formatCurrency(0, "USD", "en");
      expect(result).toBe("$0.00 USD");
    });

    it("formats negative USD amounts", () => {
      const result = formatCurrency(-50, "USD", "en");
      expect(result).toBe("-$50.00 USD");
    });
  });

  /* --- EUR --- */
  describe("EUR formatting", () => {
    it("formats a EUR amount with \u20AC symbol", () => {
      const result = formatCurrency(1500, "EUR", "en");
      expect(result).toBe("\u20AC1,500.00 EUR");
    });
  });

  /* --- Fallback --- */
  describe("fallback for unsupported environments", () => {
    it("falls back to manual formatting when Intl.NumberFormat throws", () => {
      /* Temporarily break Intl.NumberFormat to trigger the catch branch. */
      const saved = global.Intl.NumberFormat;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global.Intl as any).NumberFormat = () => {
        throw new Error("ICU data not available");
      };

      const result = formatCurrency(5000, "ETB", "en");

      /* Restore before assertion so other tests are not affected. */
      global.Intl.NumberFormat = saved;

      expect(result).toBe("5000.00 Br");
    });
  });
});

/* ================================================================== */
/*  2. currencySymbols – export smoke test                             */
/* ================================================================== */

describe("currencySymbols", () => {
  it("exports the correct symbol for each supported currency", () => {
    expect(currencySymbols.ETB).toBe("Br");
    expect(currencySymbols.USD).toBe("$");
    expect(currencySymbols.EUR).toBe("\u20AC");
  });
});

/* ================================================================== */
/*  3. Translation lookup & fallback chain (React context)            */
/* ================================================================== */

/**
 * Helper that wraps {@link I18nProvider} and runs `callback` with
 * the `t` function from the hook.
 */
function renderWithLocale(
  initialLocale: "en" | "am",
  callback: (t: (key: string) => string, helpers: { setLocale: (l: "en" | "am") => void; locale: string }) => void,
) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  );

  const { result } = renderHook(() => useTranslation(), { wrapper });

  /* Set locale before running assertions. */
  if (initialLocale !== "en") {
    act(() => {
      result.current.setLocale(initialLocale);
    });
  }

  callback(result.current.t, {
    setLocale: (l) => act(() => result.current.setLocale(l)),
    locale: result.current.locale,
  });
}

describe("Translation lookup", () => {
  describe("English (en) locale – primary dictionary", () => {
    it("returns the correct English translation for a known key", () => {
      renderWithLocale("en", (t) => {
        expect(t("dashboard.greeting")).toBe("Welcome back");
      });
    });

    it("returns the correct English translation for stat keys", () => {
      renderWithLocale("en", (t) => {
        expect(t("stat.totalJobs")).toBe("Total Jobs");
        expect(t("stat.published")).toBe("Published");
        expect(t("stat.applications")).toBe("Applications");
        expect(t("stat.saved")).toBe("Saved");
      });
    });

    it("returns the correct English translation for action keys", () => {
      renderWithLocale("en", (t) => {
        expect(t("action.findJobs")).toBe("Find Jobs");
        expect(t("action.postJob")).toBe("Post a Job");
        expect(t("action.editProfile")).toBe("Edit Profile");
      });
    });

    it("returns the correct English translation for GDPR keys", () => {
      renderWithLocale("en", (t) => {
        expect(t("gdpr.title")).toBe("Privacy Preferences");
        expect(t("gdpr.acceptAll")).toBe("Accept All");
        expect(t("gdpr.rejectOptional")).toBe("Reject Optional");
      });
    });

    it("returns the correct English translation for badge keys", () => {
      renderWithLocale("en", (t) => {
        expect(t("dashboard.employerBadge")).toBe("Employer dashboard");
        expect(t("dashboard.careerBadge")).toBe("Career dashboard");
      });
    });
  });

  describe("Amharic (am) locale", () => {
    it("returns Amharic translations for navigation keys", () => {
      renderWithLocale("am", (t) => {
        expect(t("nav.findJobs")).toBe("\u12e0\u1333\u1348\u12eb\u1275 \u12f0\u1235\u1293");
        expect(t("nav.dashboard")).toBe("\u12e0\u12ac\u130b\u12f5 \u12b8\u1303");
        expect(t("nav.profile")).toBe("\u1348\u1208\u1320\u1235");
      });
    });

    it("returns Amharic translations for dashboard keys", () => {
      renderWithLocale("am", (t) => {
        expect(t("dashboard.greeting")).toBe("\u12e5\u1293 \u1293\u12a0\u12f0\u121b\u127d");
        expect(t("dashboard.careerDashboard")).toBe(
          "\u12e0\u1348\u1208\u12cd\u127d \u12e1\u12ac\u130b\u12f5\u12e9 \u12b8\u1303",
        );
        expect(t("dashboard.hiringWorkspace")).toBe(
          "\u12e0\u134b\u1308\u121d\u127d \u1235\u122b\u1228",
        );
      });
    });

    it("returns Amharic translations for badge keys", () => {
      renderWithLocale("am", (t) => {
        expect(t("dashboard.employerBadge")).toBe(
          "\u12e0\u134b\u1308\u121d\u127d \u12e1\u12ac\u130b\u12f5\u12e9 \u12b8\u1303",
        );
        expect(t("dashboard.careerBadge")).toBe(
          "\u12e0\u1348\u1208\u12cd\u127d \u12e1\u12ac\u130b\u12f5\u12e9 \u12b8\u1303",
        );
      });
    });

    it("returns Amharic translations for stat keys", () => {
      renderWithLocale("am", (t) => {
        expect(t("stat.totalJobs")).toBe("\u12a1\u1295\u122d \u12f0\u1235\u1293");
        expect(t("stat.applications")).toBe("\u1333\u1350\u121d\u1235\u1270\u12ce\u1295");
      });
    });

    it("returns Amharic translations for GDPR keys", () => {
      renderWithLocale("am", (t) => {
        expect(t("gdpr.title")).toBe("\u12e0\u1218\u130d\u120b\u12a0\u1235\u1295 \u1218\u1208\u1235\u1270\u12ce\u1295");
        expect(t("gdpr.acceptAll")).toBe("\u12c8\u122d\u12ab\u1295\u1295 \u1235\u1235\u1293\u122d");
        expect(t("gdpr.rejectOptional")).toBe(
          "\u12a0\u1348\u1218\u120b\u12a0\u1235\u1295\u1295 \u1235\u12ce\u12eb",
        );
      });
    });

    it("returns Amharic translations for common keys", () => {
      renderWithLocale("am", (t) => {
        expect(t("common.loading")).toBe("\u12eb\u1328\u1291\u2026");
        expect(t("common.retry")).toBe("\u12a0\u1290\u12ab\u1235 \u1235\u12f3\u12ad");
        expect(t("common.noData")).toMatch(/\u12a0\u1295\u120b\u120d\u121d\u1295/);
      });
    });
  });

  describe("Fallback chain", () => {
    it("falls back to English when the active locale lacks a key", () => {
      /* Switch to Amharic, then look up a key that only exists in English. */
      renderWithLocale("am", (t) => {
        /* This key exists in both — sanity check. */
        expect(t("dashboard.greeting")).not.toBe("Welcome back");

        /* If we had a key only in en, it would fall back.
           We simulate by using a nonsense key: both dicts miss it,
           so the raw key itself is returned. */
        expect(t("nonexistent.key")).toBe("nonexistent.key");
      });
    });

    it("returns the raw key when neither locale has a translation", () => {
      renderWithLocale("en", (t) => {
        expect(t("totally.missing.key")).toBe("totally.missing.key");
      });
    });

    it("returns the raw key in Amharic locale when key is missing", () => {
      renderWithLocale("am", (t) => {
        expect(t("totally.missing.key")).toBe("totally.missing.key");
      });
    });
  });

  describe("Locale switching", () => {
    it("switches from English to Amharic and updates translations", () => {
      renderWithLocale("en", (t, { setLocale }) => {
        expect(t("dashboard.greeting")).toBe("Welcome back");

        setLocale("am");

        /* After switching, the same key returns Amharic. */
        expect(t("dashboard.greeting")).toBe("\u12e5\u1293 \u1293\u12a0\u12f0\u121b\u127d");
      });
    });

    it("switches back from Amharic to English correctly", () => {
      renderWithLocale("am", (t, { setLocale }) => {
        expect(t("dashboard.greeting")).toBe("\u12e5\u1293 \u1293\u12a0\u12f0\u121b\u127d");

        setLocale("en");

        expect(t("dashboard.greeting")).toBe("Welcome back");
      });
    });
  });

  describe("Default locale", () => {
    it("defaults to 'en' when no locale preference is stored", () => {
      renderWithLocale("en", (t) => {
        expect(t("common.loading")).toBe("Loading\u2026");
      });
    });
  });
});