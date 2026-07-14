/**
 * @file i18n.test.ts
 * Jest unit tests for i18n/config.ts and the message bundles.
 */

import { locales, defaultLocale } from "@/i18n/config";
import en from "@/messages/en.json";
import am from "@/messages/am.json";

describe("i18n/config", () => {
  test("locales contains 'en' and 'am'", () => {
    expect(locales).toContain("en");
    expect(locales).toContain("am");
  });

  test("defaultLocale is 'en'", () => {
    expect(defaultLocale).toBe("en");
  });

  test("defaultLocale is included in locales", () => {
    expect(locales).toContain(defaultLocale);
  });
});

describe("Message bundles", () => {
  const TOP_LEVEL_KEYS = ["nav", "hero", "stats", "why", "cta", "footer", "pricing", "gdpr", "currency", "common"];

  test("English bundle has all required top-level keys", () => {
    TOP_LEVEL_KEYS.forEach((key) => {
      expect(en).toHaveProperty(key);
    });
  });

  test("Amharic bundle has all required top-level keys", () => {
    TOP_LEVEL_KEYS.forEach((key) => {
      expect(am).toHaveProperty(key);
    });
  });

  test("English and Amharic bundles have the same top-level structure", () => {
    const enKeys = Object.keys(en).sort();
    const amKeys = Object.keys(am).sort();
    expect(enKeys).toEqual(amKeys);
  });

  test("nav section has all required keys in both languages", () => {
    const navKeys = ["findJobs", "forEmployers", "cvMaker", "pricing", "about", "toggleMenu", "home"];
    navKeys.forEach((k) => {
      expect(en.nav).toHaveProperty(k);
      expect(am.nav).toHaveProperty(k);
    });
  });

  test("gdpr section has all required keys in both languages", () => {
    const gdprKeys = ["title", "body", "acceptAll", "essentialOnly", "managePreferences", "save", "cancel"];
    gdprKeys.forEach((k) => {
      expect(en.gdpr).toHaveProperty(k);
      expect(am.gdpr).toHaveProperty(k);
    });
  });

  test("Amharic translations are non-empty strings", () => {
    expect(am.nav.findJobs.length).toBeGreaterThan(0);
    expect(am.hero.badge.length).toBeGreaterThan(0);
    expect(am.gdpr.title.length).toBeGreaterThan(0);
  });

  test("Amharic translations differ from English", () => {
    expect(am.nav.findJobs).not.toBe(en.nav.findJobs);
    expect(am.hero.badge).not.toBe(en.hero.badge);
    expect(am.footer.tagline).not.toBe(en.footer.tagline);
  });
});
