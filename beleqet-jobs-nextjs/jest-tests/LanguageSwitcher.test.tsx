/**
 * @file LanguageSwitcher.test.tsx
 * Jest unit tests for components/LanguageSwitcher.tsx
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";

const mockRefresh = jest.fn();

jest.mock("next-intl", () => {
  const actual = jest.requireActual("next-intl");
  return { ...actual, useLocale: () => "en" };
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

import LanguageSwitcher from "@/components/LanguageSwitcher";

function renderSwitcher() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LanguageSwitcher />
    </NextIntlClientProvider>
  );
}

beforeEach(() => { mockRefresh.mockClear(); document.cookie = "NEXT_LOCALE=; max-age=0"; });

describe("LanguageSwitcher", () => {
  test("renders a select element", async () => {
    await act(async () => { renderSwitcher(); });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  test("shows English and Amharic as options", async () => {
    await act(async () => { renderSwitcher(); });
    const values = screen.getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    expect(values).toContain("en");
    expect(values).toContain("am");
  });

  test("defaults to current locale (en)", async () => {
    await act(async () => { renderSwitcher(); });
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("en");
  });

  test("sets NEXT_LOCALE cookie and calls router.refresh() on switch", async () => {
    await act(async () => { renderSwitcher(); });
    await act(async () => {
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "am" } });
    });
    expect(document.cookie).toContain("NEXT_LOCALE=am");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  test("does NOT refresh when selecting the already-active locale", async () => {
    await act(async () => { renderSwitcher(); });
    await act(async () => {
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "en" } });
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  test("has an accessible aria-label", async () => {
    await act(async () => { renderSwitcher(); });
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-label");
  });
});
