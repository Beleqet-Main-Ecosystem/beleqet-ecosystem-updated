'use client';

import { buildSearchUrl } from '../lib/api';

/**
 * HeroSearch — client component.
 * Reads query + location inputs and redirects to the full app's job/freelance search page.
 *
 * @param {{ mode: 'jobs'|'freelance', appUrl: string }} props
 */
export default function HeroSearch({ mode, appUrl }) {
  function handleSearch(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const q = form.querySelector('#search-q')?.value ?? '';
    const location = form.querySelector('#search-loc')?.value ?? '';
    window.location.href = buildSearchUrl(q, location, mode);
  }

  const isJobs = mode !== 'freelance';

  return (
    <form className="search-bar" onSubmit={handleSearch} role="search">
      <div className="search-field">
        <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          type="text"
          id="search-q"
          name="q"
          placeholder={isJobs ? 'Job title, keyword or company' : 'What do you need done'}
          aria-label={isJobs ? 'Search jobs' : 'Search freelance projects'}
        />
      </div>
      <div className="search-divider" aria-hidden="true"></div>
      <div className="search-field" style={{ flex: 0.75 }}>
        <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <input
          type="text"
          id="search-loc"
          name="location"
          placeholder={isJobs ? 'Location e.g. Addis Ababa' : 'Budget range'}
          aria-label="Location or budget"
        />
      </div>
      <button type="submit" id="search-btn">
        {isJobs ? 'Search Jobs' : 'Find Talent'}{' '}
        <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </form>
  );
}
