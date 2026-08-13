"use client";

import type { ReactNode } from 'react';
import { ThemeProvider as LocalThemeProvider } from '@/components/theme/theme-provider';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return <LocalThemeProvider>{children}</LocalThemeProvider>;
}