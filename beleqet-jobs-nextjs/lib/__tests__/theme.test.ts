// @vitest-environment jsdom

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { ThemeProvider, useTheme } from "../../components/ThemeProvider";
import {
  applyThemePreference,
  getResolvedTheme,
  getStoredThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "../theme";

describe("theme helpers", () => {
  beforeEach(() => {
    document.documentElement.className = "";
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the user preference when it is explicitly stored", () => {
    expect(getStoredThemePreference("dark")).toBe("dark");
    expect(getStoredThemePreference("light")).toBe("light");
  });

  it("resolves the system theme when no preference is stored", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("dark"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));

    expect(getResolvedTheme("system")).toBe("dark");
  });

  it("applies the chosen theme to the document and local storage", () => {
    applyThemePreference("dark");

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("keeps the provider and global state in sync", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root: Root;

    function Probe() {
      const { theme, setTheme } = useTheme();
      return React.createElement(
        "button",
        { onClick: () => setTheme("dark") },
        theme,
      );
    }

    act(() => {
      root = createRoot(container);
      root.render(
        React.createElement(
          ThemeProvider,
          null,
          React.createElement(Probe),
        ),
      );
    });

    const button = container.querySelector("button");
    expect(button?.textContent).toBe("light");

    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(button?.textContent).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
