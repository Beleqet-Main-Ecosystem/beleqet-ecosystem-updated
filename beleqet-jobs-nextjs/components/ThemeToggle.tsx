"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Renders a clear light/dark toggle for the shared header.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/10 bg-white/80 text-primary shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <SunMedium className="h-4 w-4" />
      ) : (
        <MoonStar className="h-4 w-4" />
'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
        className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800"
        aria-label="Loading theme toggle"
        disabled
      />
    );
  }

  const isDark = resolvedTheme === 'dark';

      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        isDark
          ? 'bg-gray-800 hover:bg-gray-700 focus:ring-offset-gray-900'
          : 'bg-gray-100 hover:bg-gray-200 focus:ring-offset-white'
      }`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l-2.12-2.12a1 1 0 00-1.414 0l-2.12 2.12a1 1 0 001.414 1.414L9 11.414l1.586 1.586a1 1 0 001.414-1.414zM15 11a1 1 0 100-2h-1a1 1 0 100 2h1zm2.657-5.657a1 1 0 00-1.414 0l-1.414 1.414a1 1 0 001.414 1.414l1.414-1.414a1 1 0 000-1.414zM5 9a1 1 0 100-2H4a1 1 0 100 2h1zm3.657-5.657a1 1 0 00-1.414 1.414L7.586 5a1 1 0 001.414-1.414L8.657 3.343z"
            clipRule="evenodd"
          />
        </svg>
        <svg className="h-5 w-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}
