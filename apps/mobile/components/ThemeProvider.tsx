/**
 * ThemeProvider — wraps the app with a colour-scheme context.
 *
 * Usage:
 *   <ThemeProvider>
 *     <App />
 *   </ThemeProvider>
 *
 *   const { colorScheme, toggle } = useTheme();
 *
 * NativeWind reads the system/manual scheme via `useColorScheme()` and
 * applies the correct Tailwind dark: variants automatically.
 */

import React, { createContext, useContext, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

type Scheme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  /** Resolved scheme — always 'light' or 'dark'. */
  colorScheme: 'light' | 'dark';
  /** User preference (may be 'system'). */
  preference: Scheme;
  /** Toggle between light and dark (never system). */
  toggle: () => void;
  /** Set an explicit preference. */
  setPreference: (pref: Scheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorScheme: 'light',
  preference: 'system',
  toggle: () => undefined,
  setPreference: () => undefined,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? 'light';
  const [preference, setPreference] = useState<Scheme>('system');

  const colorScheme: 'light' | 'dark' =
    preference === 'system' ? systemScheme : preference;

  function toggle() {
    setPreference((prev) => {
      if (prev === 'system') return systemScheme === 'light' ? 'dark' : 'light';
      return prev === 'light' ? 'dark' : 'light';
    });
  }

  return (
    <ThemeContext.Provider value={{ colorScheme, preference, toggle, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Hook to access theme context from any component. */
export function useTheme() {
  return useContext(ThemeContext);
}
