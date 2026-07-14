/**
 * @file CurrencyProvider.test.tsx
 * Jest unit + integration tests for components/CurrencyProvider.tsx
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { CurrencyProvider, useCurrencyContext } from "@/components/CurrencyProvider";

const STORAGE_KEY = "beleqet-currency";

beforeEach(() => { localStorage.clear(); });

// ─── useCurrencyContext hook ──────────────────────────────────────────────────

describe("useCurrencyContext", () => {
  test("throws when used outside provider", () => {
    // Silence the expected React error
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useCurrencyContext())).toThrow(
      "useCurrencyContext must be used inside <CurrencyProvider>"
    );
    jest.restoreAllMocks();
  });

  test("returns ETB as default inside provider", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CurrencyProvider>{children}</CurrencyProvider>
    );
    const { result } = renderHook(() => useCurrencyContext(), { wrapper });
    expect(result.current.currency).toBe("ETB");
  });

  test("setCurrency updates currency for all consumers", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CurrencyProvider>{children}</CurrencyProvider>
    );
    const { result } = renderHook(() => useCurrencyContext(), { wrapper });
    act(() => { result.current.setCurrency("USD"); });
    expect(result.current.currency).toBe("USD");
  });

  test("persists chosen currency to localStorage", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <CurrencyProvider>{children}</CurrencyProvider>
    );
    const { result } = renderHook(() => useCurrencyContext(), { wrapper });
    act(() => { result.current.setCurrency("EUR"); });
    expect(localStorage.getItem(STORAGE_KEY)).toBe("EUR");
  });
});

// ─── Shared state integration ─────────────────────────────────────────────────

function PriceDisplay() {
  const { format } = useCurrencyContext();
  return <span data-testid="price">{format(1500)}</span>;
}

function Switcher({ to }: { to: string }) {
  const { setCurrency } = useCurrencyContext();
  return (
    <button onClick={() => setCurrency(to as any)}>Switch to {to}</button>
  );
}

describe("CurrencyProvider shared state", () => {
  test("price updates instantly when currency changes — no refresh needed", async () => {
    await act(async () => {
      render(
        <CurrencyProvider>
          <PriceDisplay />
          <Switcher to="USD" />
        </CurrencyProvider>
      );
    });

    // Default: ETB
    expect(screen.getByTestId("price").textContent).toContain("ETB");

    // Switch to USD
    await act(async () => {
      fireEvent.click(screen.getByText("Switch to USD"));
    });

    // Should update immediately — no page refresh
    expect(screen.getByTestId("price").textContent).toMatch(/^\$/);
  });

  test("switching ETB → EUR → GBP all update the price display", async () => {
    await act(async () => {
      render(
        <CurrencyProvider>
          <PriceDisplay />
          <Switcher to="EUR" />
          <Switcher to="GBP" />
        </CurrencyProvider>
      );
    });

    await act(async () => { fireEvent.click(screen.getByText("Switch to EUR")); });
    expect(screen.getByTestId("price").textContent).toMatch(/[€E]/);

    await act(async () => { fireEvent.click(screen.getByText("Switch to GBP")); });
    expect(screen.getByTestId("price").textContent).toMatch(/[£G]/);
  });
});
