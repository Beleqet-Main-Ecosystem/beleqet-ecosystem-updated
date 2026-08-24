"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyThemePreference,
  getStoredThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  theme: "light" | "dark";
  preference: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<"light" | "dark">("light");
  const [preference, setPreference] = useState<ThemePreference>("system");
  const preferenceRef = useRef<ThemePreference>("system");

  useEffect(() => {
    const storedPreference = getStoredThemePreference(
      window.localStorage.getItem(THEME_STORAGE_KEY),
    );

    const syncTheme = (nextPreference: ThemePreference) => {
      const resolvedTheme = applyThemePreference(nextPreference);
      preferenceRef.current = nextPreference;
      setPreference(nextPreference);
      setThemeState(resolvedTheme);
    };

    syncTheme(storedPreference);

    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        if (preferenceRef.current === "system") {
          syncTheme("system");
        }
      };

      mediaQuery.addEventListener?.("change", handleChange);
      return () => mediaQuery.removeEventListener?.("change", handleChange);
    }
  }, []);

  const setTheme = (nextPreference: ThemePreference) => {
    const resolvedTheme = applyThemePreference(nextPreference);
    preferenceRef.current = nextPreference;
    setPreference(nextPreference);
    setThemeState(resolvedTheme);
  };

  return createElement(
    ThemeContext.Provider,
    { value: { theme, preference, setTheme } },
    children,
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
