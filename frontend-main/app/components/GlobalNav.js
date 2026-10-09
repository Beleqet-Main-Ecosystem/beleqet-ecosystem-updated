'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '../../lib/i18n';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://beleqetjobs.com';

const NAV_KEYS = [
  { key: 'nav.findJobs', href: '/jobs' },
  { key: 'nav.freelance', href: '/freelance' },
  { key: 'nav.forEmployers', href: '/for-employers' },
  { key: 'nav.cvMaker', href: '/cv-maker' },
  { key: 'nav.portfolio', href: '/portfolio' },
  { key: 'nav.chatToText', href: '/chat-to-text' },
  { key: 'nav.pricing', href: '/pricing' },
  { key: 'nav.about', href: '/about' },
];

export default function GlobalNav() {
  const { t, locale, setLocale } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    // Persist theme preference
    const saved = localStorage.getItem('bq-theme');
    if (saved === 'dark') setDark(true);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('bq-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <header className={`gn${scrolled ? ' gn--scrolled' : ''}`} id="site-nav" role="banner">
      <div className="gn__inner">
        {/* ── Logo ── */}
        <Link href="/" className="gn__brand" aria-label="Beleqet Jobs home">
          <span className="gn__logo-dot" aria-hidden="true">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l18-7-7 18-2-8-8-2z" />
            </svg>
          </span>
          <span className="gn__wordmark">
            <b>Beleqet</b>
          </span>
          <span className="gn__pill" aria-label="Jobs and Freelance">
            + Freelance
          </span>
        </Link>

        {/* ── Desktop nav ── */}
        <nav className="gn__links" aria-label="Main navigation">
          {NAV_KEYS.map(({ key, href }) => (
            <Link key={href} href={href} className="gn__link">
              {t(key)}
            </Link>
          ))}
        </nav>

        {/* ── Right actions ── */}
        <div className="gn__actions">
          {/* Language toggle */}
          <button
            className="gn__theme-btn"
            aria-label="Switch language"
            onClick={() => setLocale(locale === 'en' ? 'am' : 'en')}
            style={{ fontWeight: 'bold', fontSize: '13px' }}
          >
            {locale === 'en' ? 'አማ' : 'EN'}
          </button>

          {/* Theme toggle */}
          <button
            className="gn__theme-btn"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={() => setDark((d) => !d)}
          >
            {dark ? (
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <Link className="gn__btn gn__btn--ghost" href="/login">
            {t('nav.login')}
          </Link>
          <Link className="gn__btn gn__btn--ghost" href="/login?tab=signup">
            {t('nav.signUp')}
          </Link>
          <Link className="gn__btn gn__btn--cta" href="/post-job" id="nav-cta">
            {t('nav.postJob')}
          </Link>

          {/* Mobile hamburger */}
          <button
            className="gn__ham"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className={`gn__ham-line${menuOpen ? ' open' : ''}`} />
            <span className={`gn__ham-line${menuOpen ? ' open' : ''}`} />
            <span className={`gn__ham-line${menuOpen ? ' open' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      {menuOpen && (
        <nav className="gn__drawer" aria-label="Mobile navigation">
          {NAV_KEYS.map(({ key, href }) => (
            <Link
              key={href}
              href={href}
              className="gn__drawer-link"
              onClick={() => setMenuOpen(false)}
            >
              {t(key)}
            </Link>
          ))}
          <div className="gn__drawer-actions">
            <button
              className="gn__btn gn__btn--ghost"
              onClick={() => {
                setLocale(locale === 'en' ? 'am' : 'en');
                setMenuOpen(false);
              }}
              style={{ fontWeight: 'bold' }}
            >
              {locale === 'en' ? 'አማርኛ' : 'English'}
            </button>
            <Link
              className="gn__btn gn__btn--ghost"
              href="/login"
              onClick={() => setMenuOpen(false)}
            >
              {t('nav.login')}
            </Link>
            <Link
              className="gn__btn gn__btn--cta"
              href="/post-job"
              onClick={() => setMenuOpen(false)}
            >
              {t('nav.postJob')}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
