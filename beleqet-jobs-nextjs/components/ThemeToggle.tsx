'use client';

/**
 * @file ThemeToggle.tsx
 * @description
 * Theme toggle button component for switching between dark/light/system themes.
 * Displays current theme with Sun/Moon icons and provides a dropdown menu for selection.
 *
 * Features:
 * - Smooth transitions between theme states
 * - Responsive dropdown menu
 * - Visual feedback for current theme
 * - Accessible button with proper ARIA labels
 *
 * GDPR notes:
 *  - No personal data collected
 *  - Theme preference stored locally in localStorage
 */
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useState } from 'react';

/**
 * ThemeToggle component that renders a button to switch themes.
 * Shows a dropdown menu with Light/Dark/System options when clicked.
 */
export function ThemeToggle() {
  const { theme, setTheme, actualTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themes: { value: 'light' | 'dark' | 'system'; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ];

  const getCurrentIcon = () => {
    if (theme === 'system') {
      return actualTheme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />;
    }
    return theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brandGreen focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        aria-label="Toggle theme"
        aria-expanded={isOpen}
      >
        <span className="sr-only">Toggle theme</span>
        {getCurrentIcon()}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  setTheme(t.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  theme === t.value
                    ? 'bg-brandGreen/10 text-brandGreen dark:bg-brandGreen/20'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
