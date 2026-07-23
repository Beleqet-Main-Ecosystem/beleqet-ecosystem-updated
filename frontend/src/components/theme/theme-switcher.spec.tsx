import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getThemePreference, updateThemePreference } from '@/lib/api';
import { ThemeProvider } from './theme-provider';
import { ThemeSwitcher } from './theme-switcher';

vi.mock('@/lib/api', () => ({
  getThemePreference: vi.fn(),
  updateThemePreference: vi.fn(),
}));

const getThemePreferenceMock = vi.mocked(getThemePreference);
const updateThemePreferenceMock = vi.mocked(updateThemePreference);

/** Builds the browser API shape needed by the SYSTEM-mode listener. */
function createMatchMedia(): (query: string) => MediaQueryList {
  return (): MediaQueryList =>
    ({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as MediaQueryList;
}

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    window.matchMedia = createMatchMedia();
    localStorage.clear();
    getThemePreferenceMock.mockResolvedValue({ theme: 'SYSTEM' });
    updateThemePreferenceMock.mockResolvedValue({ theme: 'SYSTEM' });
  });

  afterEach(() => vi.clearAllMocks());

  it('renders three accessible theme choices', async () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );

    expect(screen.getByRole('button', { name: 'Light' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'System' })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('true'),
    );
  });

  it('updates UI state, local cache, and the User Preferences API when Light is selected', async () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Light' }));

    await waitFor(() => expect(updateThemePreferenceMock).toHaveBeenCalledWith('LIGHT'));
    expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('beleqet.theme')).toBe('LIGHT');
  });
});
