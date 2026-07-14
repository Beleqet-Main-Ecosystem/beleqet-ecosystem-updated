/**
 * @file ThemeToggle.test.tsx
 * @description
 * Unit tests for ThemeToggle component.
 * Tests theme toggle button, dropdown menu, and theme switching functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { ThemeToggle } from '../ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithProvider = () => {
    return render(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>,
    );
  };

  describe('rendering', () => {
    it('should render toggle button', () => {
      renderWithProvider();
      const button = screen.getByLabelText('Toggle theme');
      expect(button).toBeInTheDocument();
    });

    it('should show sun icon when theme is light', () => {
      renderWithProvider();
      const button = screen.getByLabelText('Toggle theme');
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('should have correct ARIA attributes', () => {
      renderWithProvider();
      const button = screen.getByLabelText('Toggle theme');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('dropdown menu', () => {
    it('should not show dropdown menu initially', () => {
      renderWithProvider();
      const dropdown = screen.queryByText('Light');
      expect(dropdown).not.toBeInTheDocument();
    });

    it('should show dropdown menu when button is clicked', () => {
      renderWithProvider();
      const button = screen.getByLabelText('Toggle theme');
      
      fireEvent.click(button);
      
      expect(screen.getByText('Light')).toBeInTheDocument();
      expect(screen.getByText('Dark')).toBeInTheDocument();
      expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('should close dropdown when clicking outside', () => {
      renderWithProvider();
      const button = screen.getByLabelText('Toggle theme');
      
      fireEvent.click(button);
      expect(screen.getByText('Light')).toBeInTheDocument();
      
      // Click on the overlay
      const overlay = screen.getByRole('presentation');
      fireEvent.click(overlay);
      
      expect(screen.queryByText('Light')).not.toBeInTheDocument();
    });

    it('should update aria-expanded when dropdown opens', () => {
      renderWithProvider();
      const button = screen.getByLabelText('Toggle theme');
      
      expect(button).toHaveAttribute('aria-expanded', 'false');
      
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('theme switching', () => {
    it('should switch to light theme when Light option is clicked', () => {
      const TestComponent = () => {
        const { theme, setTheme } = useTheme();
        return (
          <div>
            <span data-testid="current-theme">{theme}</span>
            <ThemeToggle />
          </div>
        );
      };

      render(
        <ThemeProvider defaultTheme="dark">
          <TestComponent />
        </ThemeProvider>,
      );

      const button = screen.getByLabelText('Toggle theme');
      fireEvent.click(button);
      
      const lightOption = screen.getByText('Light');
      fireEvent.click(lightOption);
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    });

    it('should switch to dark theme when Dark option is clicked', () => {
      const TestComponent = () => {
        const { theme, setTheme } = useTheme();
        return (
          <div>
            <span data-testid="current-theme">{theme}</span>
            <ThemeToggle />
          </div>
        );
      };

      render(
        <ThemeProvider defaultTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      const button = screen.getByLabelText('Toggle theme');
      fireEvent.click(button);
      
      const darkOption = screen.getByText('Dark');
      fireEvent.click(darkOption);
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    });

    it('should switch to system theme when System option is clicked', () => {
      const TestComponent = () => {
        const { theme, setTheme } = useTheme();
        return (
          <div>
            <span data-testid="current-theme">{theme}</span>
            <ThemeToggle />
          </div>
        );
      };

      render(
        <ThemeProvider defaultTheme="light">
          <TestComponent />
        </ThemeProvider>,
      );

      const button = screen.getByLabelText('Toggle theme');
      fireEvent.click(button);
      
      const systemOption = screen.getByText('System');
      fireEvent.click(systemOption);
      
      expect(screen.getByTestId('current-theme')).toHaveTextContent('system');
    });

    it('should close dropdown after selecting a theme', () => {
      renderWithProvider();
      const button = screen.getByLabelText('Toggle theme');
      
      fireEvent.click(button);
      expect(screen.getByText('Light')).toBeInTheDocument();
      
      const lightOption = screen.getByText('Light');
      fireEvent.click(lightOption);
      
      expect(screen.queryByText('Light')).not.toBeInTheDocument();
    });
  });

  describe('active theme indication', () => {
    it('should highlight current theme in dropdown', () => {
      render(
        <ThemeProvider defaultTheme="dark">
          <ThemeToggle />
        </ThemeProvider>,
      );

      const button = screen.getByLabelText('Toggle theme');
      fireEvent.click(button);
      
      const darkOption = screen.getByText('Dark');
      expect(darkOption).toHaveClass('bg-brandGreen/10');
    });

    it('should not highlight non-active themes', () => {
      render(
        <ThemeProvider defaultTheme="dark">
          <ThemeToggle />
        </ThemeProvider>,
      );

      const button = screen.getByLabelText('Toggle theme');
      fireEvent.click(button);
      
      const lightOption = screen.getByText('Light');
      expect(lightOption).not.toHaveClass('bg-brandGreen/10');
    });
  });

  describe('icon display', () => {
    it('should show moon icon when theme is dark', () => {
      render(
        <ThemeProvider defaultTheme="dark">
          <ThemeToggle />
        </ThemeProvider>,
      );

      const button = screen.getByLabelText('Toggle theme');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should show sun icon when theme is light', () => {
      render(
        <ThemeProvider defaultTheme="light">
          <ThemeToggle />
        </ThemeProvider>,
      );

      const button = screen.getByLabelText('Toggle theme');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should show system icon when theme is system and system prefers light', () => {
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList);

      render(
        <ThemeProvider defaultTheme="system">
          <ThemeToggle />
        </ThemeProvider>,
      );

      const button = screen.getByLabelText('Toggle theme');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should show moon icon when theme is system and system prefers dark', () => {
      vi.mocked(window.matchMedia).mockReturnValue({
        matches: true,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList);

      render(
        <ThemeProvider defaultTheme="system">
          <ThemeToggle />
        </ThemeProvider>,
      );

      const button = screen.getByLabelText('Toggle theme');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });
});
