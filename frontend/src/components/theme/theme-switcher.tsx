'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeTranslation } from '@/i18n/use-theme-translation';
import { useTheme } from './theme-provider';
import type { ThemePreference } from './theme-preference';

/**
 * Lets a user choose light, dark, or OS-synchronised display mode.
 * Every option remains visible, avoiding a hidden state cycle and preserving
 * a constant control footprint during theme changes.
 */
export function ThemeSwitcher(): JSX.Element {
  const { preference, isMounted, setPreference } = useTheme();
  const { t } = useThemeTranslation();
  const options: ReadonlyArray<{ value: ThemePreference; key: 'theme.light' | 'theme.dark' | 'theme.system'; icon: JSX.Element }> = [
    { value: 'LIGHT', key: 'theme.light', icon: <Sun aria-hidden="true" size={16} /> },
    { value: 'DARK', key: 'theme.dark', icon: <Moon aria-hidden="true" size={16} /> },
    { value: 'SYSTEM', key: 'theme.system', icon: <Monitor aria-hidden="true" size={16} /> },
  ];

  return (
    <div aria-label={t('theme.label')} className="theme-switcher" role="group">
      {options.map((option) => (
        <button
          aria-label={t(option.key)}
          aria-pressed={isMounted && preference === option.value}
          className={preference === option.value ? 'theme-switcher-option active' : 'theme-switcher-option'}
          key={option.value}
          onClick={(): void => setPreference(option.value)}
          type="button"
        >
          {option.icon}
          <span>{t(option.key)}</span>
        </button>
      ))}
    </div>
  );
}
