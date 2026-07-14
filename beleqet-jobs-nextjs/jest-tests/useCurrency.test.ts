/**
 * @file useCurrency.test.ts
 * Jest unit tests for hooks/useCurrency.ts and lib/currency.ts
 */

import { renderHook, act } from "@testing-library/react";
import { useCurrency, CURRENCIES } from "@/hooks/useCurrency";
import { convertFromETB, formatCurrency } from "@/lib/currency";

const STORAGE_KEY = "beleqet-currency";

beforeEach(() => { localStorage.clear(); });

// ─── useCurrency hook ─────────────────────────────────────────────────────────

describe("useCurrency hook", () => {
  test("defaults to ETB", () => {
    const { result } = renderHook(() => useCurrency());
    expect(result.current.currency).toBe("ETB");
  });

  test("formats ETB amount with prefix and no decimals", () => {
    const { result } = renderHook(() => useCurrency());
    expect(result.current.format(1500)).toBe("ETB 1,500");
  });

  test("converts ETB → USD using rate table", () => {
    const { result } = renderHook(() => useCurrency());
    act(() => { result.current.setCurrency("USD"); });
    const expected = 1500 * CURRENCIES.USD.rateFromETB;
    expect(result.current.convert(1500)).toBeCloseTo(expected, 4);
  });

  test("formats USD with dollar sign", () => {
    const { result } = renderHook(() => useCurrency());
    act(() => { result.current.setCurrency("USD"); });
    expect(result.current.format(1500)).toMatch(/^\$/);
  });

  test("persists selected currency to localStorage", () => {
    const { result } = renderHook(() => useCurrency());
    act(() => { result.current.setCurrency("GBP"); });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("GBP");
  });

  test("restores currency from localStorage on mount", () => {
    localStorage.setItem(STORAGE_KEY, "EUR");
    const { result } = renderHook(() => useCurrency());
    expect(["ETB", "EUR"]).toContain(result.current.currency);
  });

  test("exposes all 4 currencies", () => {
    const { result } = renderHook(() => useCurrency());
    expect(result.current.currencies).toHaveLength(4);
    const codes = result.current.currencies.map((c) => c.code);
    ["ETB", "USD", "EUR", "GBP"].forEach((c) => expect(codes).toContain(c));
  });

  test("handles zero amount", () => {
    const { result } = renderHook(() => useCurrency());
    expect(result.current.convert(0)).toBe(0);
  });
});

// ─── lib/currency pure utils ──────────────────────────────────────────────────

describe("convertFromETB", () => {
  test("ETB → ETB returns same amount", () => {
    expect(convertFromETB(1500, "ETB")).toBe(1500);
  });

  test("ETB → USD uses rate", () => {
    expect(convertFromETB(1500, "USD")).toBeCloseTo(1500 * CURRENCIES.USD.rateFromETB, 5);
  });

  test("ETB → EUR uses rate", () => {
    expect(convertFromETB(1500, "EUR")).toBeCloseTo(1500 * CURRENCIES.EUR.rateFromETB, 5);
  });

  test("ETB → GBP uses rate", () => {
    expect(convertFromETB(1500, "GBP")).toBeCloseTo(1500 * CURRENCIES.GBP.rateFromETB, 5);
  });

  test("zero input returns zero", () => {
    expect(convertFromETB(0, "USD")).toBe(0);
  });
});

describe("formatCurrency", () => {
  test("formats ETB with no decimals and prefix", () => {
    expect(formatCurrency(1500, "ETB")).toBe("ETB 1,500");
  });

  test("defaults to ETB when no currency given", () => {
    expect(formatCurrency(1500)).toBe("ETB 1,500");
  });

  test("formats USD with dollar sign", () => {
    expect(formatCurrency(1500, "USD")).toMatch(/^\$/);
  });

  test("formats EUR with symbol or code", () => {
    expect(formatCurrency(1500, "EUR")).toMatch(/[€E]/);
  });

  test("formats GBP with pound sign or code", () => {
    expect(formatCurrency(1500, "GBP")).toMatch(/[£G]/);
  });
});
