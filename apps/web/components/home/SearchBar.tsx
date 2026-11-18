'use client';

import React, { useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { buildSearchUrl } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

export default function SearchBar() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    window.location.assign(buildSearchUrl(q.trim(), loc.trim(), 'jobs'));
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-2 rounded-xl bg-white p-2 shadow-search sm:flex-row sm:items-center"
    >
      <div className="flex min-h-12 flex-1 items-center gap-2 rounded-md px-3 focus-within:bg-ink-50">
        <Search className="size-5 shrink-0 text-ink-500" aria-hidden="true" />
        <label htmlFor="search-q" className="sr-only">
          {t('hero.searchLabel')}
        </label>
        <input
          id="search-q"
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('hero.searchPlaceholder')}
          className="w-full bg-transparent text-base text-ink-900 placeholder:text-ink-500 focus:outline-none"
          autoComplete="off"
        />
      </div>

      <div className="hidden h-8 w-px bg-ink-200 sm:block" aria-hidden="true" />

      <div className="flex min-h-12 flex-1 items-center gap-2 rounded-md px-3 focus-within:bg-ink-50 sm:max-w-[16rem]">
        <MapPin className="size-5 shrink-0 text-ink-500" aria-hidden="true" />
        <label htmlFor="search-loc" className="sr-only">
          {t('hero.locationLabel')}
        </label>
        <input
          id="search-loc"
          name="location"
          type="text"
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          placeholder={t('hero.locationPlaceholder')}
          className="w-full bg-transparent text-base text-ink-900 placeholder:text-ink-500 focus:outline-none"
          autoComplete="off"
        />
      </div>

      <button
        type="submit"
        className="min-h-12 rounded-md bg-brand-600 px-6 text-base font-semibold text-white transition-colors hover:bg-brand-700"
      >
        {t('hero.searchButton')}
      </button>
    </form>
  );
}
