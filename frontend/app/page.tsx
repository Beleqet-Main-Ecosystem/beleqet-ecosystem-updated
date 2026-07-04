import React from 'react';
import { ThemeToggle } from '../src/theme';

/**
 * Demo page for the Dark/Light Mode module.
 *
 * This page exists only to give the toggle somewhere to render — it is
 * intentionally the only page in this scaffold. See root README.md for
 * why a minimal Next.js host was added even though it wasn't explicitly
 * part of the task brief.
 *
 * @returns The demo page.
 */
export default function HomePage(): JSX.Element {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Dark / Light Mode</h1>
        <p className="text-textSecondary-light dark:text-textSecondary-dark text-sm max-w-sm">
          Click the toggle to switch between Light and Dark. Your choice is
          saved and will still be applied next time you load this page.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <ThemeToggle locale="en" />
        <ThemeToggle locale="am" />
      </div>
    </main>
  );
}
