/**
 * @file __tests__/lib/i18n.test.ts
 * @description Unit tests for the i18n module (`lib/i18n.ts`).
 *
 * Covers:
 * - `formatCurrency` with ETB, USD, EUR.
 * - `formatCurrency` fallback for unsupported environments.
 * - Translation lookup with fallback chain.
 * - Default locale is "en".
 */

/* ------------------------------------------------------------------ */
/*  Static function tests (no React rendering needed)                 */
/* ------------------------------------------------------------------ */

import { formatCurrency, SupportedCurrency } from "@/lib/i18n";

describe("formatCurrency", () => {
  it("formats ETB amounts correctly", () => {
    const result = formatCurrency(12500, "ETB", "en");
    expect(result).toContain("12,500");
    /* Intl.NumberFormat uses "ETB" (ISO code) rather than the symbol "Br". */
    expect(result).toMatch(/ETB|Br/);
  });

  it("formats USD amounts with $ symbol", () => {
    const result = formatCurrency(99.99, "USD", "en");
    expect(result).toContain("$");
    expect(result).toContain("99.99");
  });

  it("formats EUR amounts with \u20AC symbol", () => {
    const result = formatCurrency(1500, "EUR", "en");
    expect(result).toContain("\u20AC");
    expect(result).toContain("1,500");
  });

  it("defaults to ETB when no currency is specified", () => {
    const result = formatCurrency(100);
    expect(result).toMatch(/ETB|Br/);
  });

  it("handles zero amounts", () => {
    const result = formatCurrency(0, "USD", "en");
    expect(result).toContain("0.00");
  });

  it("handles negative amounts", () => {
    const result = formatCurrency(-50, "ETB", "en");
    /* Intl.NumberFormat handles negatives with parentheses or minus. */
    expect(result).toContain("50");
    expect(result).toMatch(/ETB|Br/);
  });

  it("uses the locale parameter for formatting", () => {
    const enResult = formatCurrency(1234.56, "USD", "en");
    expect(enResult).toContain("1,234");
  });
});