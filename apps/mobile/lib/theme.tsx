import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as useSystemScheme } from 'react-native';
import { colorScheme as nativewindScheme } from 'nativewind';
import * as SecureStore from 'expo-secure-store';

export type ThemePreference = 'system' | 'light' | 'dark';
const THEME_KEY = 'beleqet_theme';

/** Colours for places classes can't reach: icons, spinners, the tab bar, status bar. */
export const PALETTE = {
  light: {
    bg: '#F6F7F4',
    surface: '#FFFFFF',
    text: '#121922',
    muted: '#6b7885',
    border: '#E3E8EC',
    accent: '#00653B',
    onAccent: '#FFFFFF',
    header: '#041603',
    onHeader: '#FFFFFF',
    lime: '#d8ff3e',
    danger: '#B42318',
  },
  dark: {
    bg: '#06130A',
    surface: '#0D1E13',
    text: '#FFFFFF',
    muted: '#94A3B8',
    border: '#172C1D',
    accent: '#d8ff3e',
    onAccent: '#041603',
    header: '#041603',
    onHeader: '#FFFFFF',
    lime: '#d8ff3e',
    danger: '#FCA5A5',
  },
};
export type Palette = (typeof PALETTE)['light'];

type Theme = { scheme: 'light' | 'dark'; preference: ThemePreference; setPreference: (p: ThemePreference) => void; colors: Palette };
const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useSystemScheme() === 'dark' ? 'dark' : 'light';
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setPreferenceState(saved);
      })
      .catch(() => undefined);
  }, []);

  const scheme = preference === 'system' ? system : preference;

  // NativeWind applies the dark: variants from this.
  useEffect(() => {
    nativewindScheme.set(scheme);
  }, [scheme]);

  const value = useMemo<Theme>(
    () => ({
      scheme,
      preference,
      colors: PALETTE[scheme],
      setPreference: (next) => {
        setPreferenceState(next);
        SecureStore.setItemAsync(THEME_KEY, next).catch(() => undefined);
      },
    }),
    [scheme, preference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
