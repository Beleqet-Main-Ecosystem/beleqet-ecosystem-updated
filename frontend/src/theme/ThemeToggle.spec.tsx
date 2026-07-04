import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from './ThemeProvider';
import { ThemeToggle } from './ThemeToggle';
import { isValidThemePreference } from './theme-preference.dto';

/**
 * Renders {@link ThemeToggle} inside its required {@link ThemeProvider},
 * mirroring how it will actually be used in the app.
 */
function renderToggle(): void {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
  });

  it('renders once the client has resolved a theme', async () => {
    renderToggle();

    const button = await screen.findByRole('button', { name: /toggle color theme/i });
    expect(button).toBeInTheDocument();
  });

  it('flips directly between Light and Dark with no third state', async () => {
    renderToggle();
    const button = await screen.findByRole('button', { name: /toggle color theme/i });

    // jsdom's matchMedia polyfill reports no system preference, so the
    // module falls back to "light" as the resolved starting point.
    await waitFor(() => expect(button).toHaveTextContent('Light'));

    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveTextContent('Dark'));

    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveTextContent('Light'));

    // Only ever these two labels appear — never "System".
    expect(button).not.toHaveTextContent('System');
  });

  it('persists the chosen preference to localStorage', async () => {
    renderToggle();
    const button = await screen.findByRole('button', { name: /toggle color theme/i });

    fireEvent.click(button);

    await waitFor(() => {
      const stored = window.localStorage.getItem('theme');
      expect(isValidThemePreference(stored)).not.toBeNull();
      expect(stored).not.toBe('system');
    });
  });

  it('renders Amharic labels when locale="am" is passed', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle locale="am" />
      </ThemeProvider>,
    );

    const button = await screen.findByRole('button', { name: /የገጽ ገጽታ ቀይር/ });
    expect(button).toBeInTheDocument();
  });
});

describe('isValidThemePreference', () => {
  it('accepts the three allowed values', () => {
    expect(isValidThemePreference('light')).toBe('light');
    expect(isValidThemePreference('dark')).toBe('dark');
    expect(isValidThemePreference('system')).toBe('system');
  });

  it('rejects anything else, including tampered localStorage values', () => {
    expect(isValidThemePreference('Dark')).toBeNull();
    expect(isValidThemePreference('rainbow')).toBeNull();
    expect(isValidThemePreference(null)).toBeNull();
    expect(isValidThemePreference(undefined)).toBeNull();
    expect(isValidThemePreference(42)).toBeNull();
  });
});
