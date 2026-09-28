'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/theme/theme-provider';
import { resolvesToDark } from '@/components/theme/theme-preference';

/**
 * Theme toggle button that switches between light and dark mode
 * using the native Beleqet ThemeProvider.
 */
export function ThemeToggle() {
  const { preference, isMounted, setPreference } = useTheme();

  if (!isMounted) {
    return (
      <button className="btn btn-ghost btn-sm" style={{ opacity: 0, width: '110px' }} type="button">
        Loading...
      </button>
    );
  }

  const systemPrefersDark =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  const isDark = resolvesToDark(preference, systemPrefersDark);

  return (
    <button
      onClick={() => setPreference(isDark ? 'LIGHT' : 'DARK')}
      className="btn btn-ghost btn-sm"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        fontSize: '12px',
      }}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      type="button"
    >
      {isDark ? (
        <>
          <Sun size={15} style={{ color: 'var(--accent-amber)' }} />
          <span>Light Mode</span>
        </>
      ) : (
        <>
          <Moon size={15} style={{ color: 'var(--accent-indigo)' }} />
          <span>Dark Mode</span>
        </>
      )}
    </button>
  );
}

export default ThemeToggle;