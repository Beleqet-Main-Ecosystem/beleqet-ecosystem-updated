/**
 * @file CookieBanner.test.tsx
 * Jest unit + integration tests for components/CookieBanner.tsx
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import CookieBanner from "@/components/CookieBanner";

const STORAGE_KEY = "beleqet-cookie-consent";

/** Helper — always wrap with provider so useTranslations works */
function renderBanner() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CookieBanner />
    </NextIntlClientProvider>
  );
}

beforeEach(() => { localStorage.clear(); });

describe("CookieBanner", () => {
  test("renders when no prior consent exists", async () => {
    await act(async () => { renderBanner(); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("shows translated title text", async () => {
    await act(async () => { renderBanner(); });
    expect(screen.getByText(en.gdpr.title)).toBeInTheDocument();
  });

  test("does NOT render when valid consent is already stored", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      essential: true, analytics: false, marketing: false,
      timestamp: new Date().toISOString(), version: 1,
    }));
    await act(async () => { renderBanner(); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("Accept All — hides banner and saves full consent", async () => {
    await act(async () => { renderBanner(); });
    await act(async () => { fireEvent.click(screen.getByText(en.gdpr.acceptAll)); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved).toMatchObject({ essential: true, analytics: true, marketing: true });
  });

  test("Essential Only — hides banner and saves minimal consent", async () => {
    await act(async () => { renderBanner(); });
    await act(async () => { fireEvent.click(screen.getByText(en.gdpr.essentialOnly)); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved).toMatchObject({ essential: true, analytics: false, marketing: false });
  });

  test("Manage Preferences — opens preferences panel", async () => {
    await act(async () => { renderBanner(); });
    await act(async () => { fireEvent.click(screen.getByText(en.gdpr.managePreferences)); });
    expect(screen.getByText(en.gdpr.prefsHeading)).toBeInTheDocument();
    expect(screen.getByText(en.gdpr.analyticsLabel)).toBeInTheDocument();
    expect(screen.getByText(en.gdpr.marketingLabel)).toBeInTheDocument();
  });

  test("Save Preferences — saves custom selection and hides banner", async () => {
    await act(async () => { renderBanner(); });
    await act(async () => { fireEvent.click(screen.getByText(en.gdpr.managePreferences)); });
    // Toggle analytics ON
    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: en.gdpr.analyticsLabel }));
    });
    await act(async () => { fireEvent.click(screen.getByText(en.gdpr.save)); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.analytics).toBe(true);
    expect(saved.marketing).toBe(false);
  });

  test("Cancel — closes preferences without saving", async () => {
    await act(async () => { renderBanner(); });
    await act(async () => { fireEvent.click(screen.getByText(en.gdpr.managePreferences)); });
    await act(async () => { fireEvent.click(screen.getByText(en.gdpr.cancel)); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("saved consent includes ISO timestamp and version=1", async () => {
    await act(async () => { renderBanner(); });
    await act(async () => { fireEvent.click(screen.getByText(en.gdpr.acceptAll)); });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(new Date(saved.timestamp).getTime()).not.toBeNaN();
    expect(saved.version).toBe(1);
  });
});
