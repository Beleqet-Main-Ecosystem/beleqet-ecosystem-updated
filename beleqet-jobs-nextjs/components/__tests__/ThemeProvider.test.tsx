/**
 * @file ThemeProvider.test.tsx
 * @description
 * Unit tests for ThemeProvider component.
 * Tests theme state management, localStorage persistence, and system preference detection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeProvider';

describe('ThemeProvider', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Mock window.matchMedia
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

  describe('useTheme hook', () => {
    it('should throw error when used outside ThemeProvider', () => {
      // Suppress console error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('initial theme state', () => {
    it('should default to system theme when no localStorage value exists', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('system');
    });

    it('should load theme from localStorage when value exists', () => {
      localStorage.setItem('beleqet-theme', 'dark');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('dark');
    });

    it('should use custom storage key when provided', () => {
      localStorage.setItem('custom-theme-key', 'light');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider storageKey="custom-theme-key">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('light');
    });
  });

  describe('actual theme calculation', () => {
    it('should set actual theme to light when system preference is light', () => {
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

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="system">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.actualTheme).toBe('light');
    });

    it('should set actual theme to dark when system preference is dark', () => {
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

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="system">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.actualTheme).toBe('dark');
    });

    it('should use explicit dark theme when set to dark', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('dark');
      expect(result.current.actualTheme).toBe('dark');
    });

    it('should use explicit light theme when set to light', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('light');
      expect(result.current.actualTheme).toBe('light');
    });
  });

  describe('setTheme function', () => {
    it('should update theme state when called', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
    });

    it('should persist theme to localStorage when set', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('light');
      });

      expect(localStorage.getItem('beleqet-theme')).toBe('light');
    });

    it('should update actual theme when switching from system to explicit', () => {
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

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="system">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.actualTheme).toBe('dark');

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.actualTheme).toBe('light');
    });
  });

  describe('system preference changes', () => {
    it('should update actual theme when system preference changes', () => {
      let mediaQueryCallback: ((e: MediaQueryListEvent) => void) | null = null;

      vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, callback: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            mediaQueryCallback = callback;
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="system">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.actualTheme).toBe('light');

      act(() => {
        mediaQueryCallback?.({ matches: true } as MediaQueryListEvent);
      });

      expect(result.current.actualTheme).toBe('dark');
    });

    it('should not update actual theme when not in system mode', () => {
      let mediaQueryCallback: ((e: MediaQueryListEvent) => void) | null = null;

      vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, callback: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            mediaQueryCallback = callback;
          }
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.actualTheme).toBe('light');

      act(() => {
        mediaQueryCallback?.({ matches: true } as MediaQueryListEvent);
      });

      expect(result.current.actualTheme).toBe('light');
    });
  });

  describe('DOM class manipulation', () => {
    it('should add dark class to document element when theme is dark', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
      );

      renderHook(() => useTheme(), { wrapper });

      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains('light')).toBe(false);
    });

    it('should add light class to document element when theme is light', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
      );

      renderHook(() => useTheme(), { wrapper });

      expect(document.documentElement.classList.contains('light')).toBe(true);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('should remove previous theme class when switching themes', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(document.documentElement.classList.contains('dark')).toBe(true);

      act(() => {
        result.current.setTheme('light');
      });

      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(document.documentElement.classList.contains('light')).toBe(true);
    });
  });
});
