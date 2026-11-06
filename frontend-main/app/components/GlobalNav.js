'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '../../lib/i18n';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://beleqetjobs.com';

const NAV = [
  { key: 'nav.findJobs', href: '/jobs' },
  { key: 'nav.freelance', href: '/freelance' },
  { key: 'nav.cvMaker', href: '/cv-maker' },
  { key: 'nav.pricing', href: '/pricing' },
  { key: 'nav.contact', href: '/contact' },
];

export default function GlobalNav() {
  const { t, locale, setLocale } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auth detection across storage and cookies
  useEffect(() => {
    try {
      const stored = localStorage.getItem('beleqet_user');
      const token = localStorage.getItem('beleqet_token');
      if (stored) {
        setUser(JSON.parse(stored));
      } else if (token) {
        setUser({ loggedIn: true });
      } else if (typeof document !== 'undefined') {
        const match = document.cookie.match(/beleqet_token=([^;]+)/);
        if (match) setUser({ loggedIn: true });
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem('beleqet_user');
      localStorage.removeItem('beleqet_token');
      localStorage.removeItem('beleqet_refresh');
      document.cookie = 'beleqet_token=; path=/; max-age=0';
      document.cookie = 'beleqet_user=; path=/; max-age=0';
    } catch {
      // ignore
    }
    setUser(null);
    window.location.reload();
  };

  const accountLabel = user?.firstName ? user.firstName : locale === 'am' ? 'መለያ' : 'Dashboard';
  const signOutLabel = locale === 'am' ? 'ውጣ' : 'Sign Out';

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
            <b>Beleqet Job</b>
          </span>
          <span className="gn__pill" aria-label="Jobs and Freelance">
            + Freelance
          </span>
        </Link>

        {/* ── Desktop nav ── */}
        <nav className="gn__links" aria-label="Main navigation">
          {NAV.map(({ key, href }) => (
            <Link key={href} href={href} className="gn__link">
              {t(key)}
            </Link>
          ))}
        </nav>

        {/* ── Right actions ── */}
        <div className="gn__actions">
          <button
            type="button"
            className="gn__lang"
            aria-label="Switch language"
            onClick={() => setLocale(locale === 'en' ? 'am' : 'en')}
          >
            {locale === 'en' ? 'አማ' : 'EN'}
          </button>

          {user ? (
            <>
              <a className="gn__btn gn__btn--ghost" href={`${APP_URL}/profile`}>
                {accountLabel}
              </a>
              <button type="button" className="gn__btn gn__btn--ghost" onClick={handleLogout}>
                {signOutLabel}
              </button>
            </>
          ) : (
            <Link className="gn__btn gn__btn--ghost" href="/login">
              {t('nav.login')}
            </Link>
          )}

          <Link className="gn__btn gn__btn--cta" href="/post-job" id="nav-cta">
            {t('nav.postJob')}
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
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
          {NAV.map(({ key, href }) => (
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
              type="button"
              className="gn__btn gn__btn--ghost"
              onClick={() => {
                setLocale(locale === 'en' ? 'am' : 'en');
                setMenuOpen(false);
              }}
            >
              {locale === 'en' ? 'አማርኛ' : 'English'}
            </button>
            {user ? (
              <>
                <a
                  className="gn__btn gn__btn--ghost"
                  href={`${APP_URL}/profile`}
                  onClick={() => setMenuOpen(false)}
                >
                  {accountLabel}
                </a>
                <button
                  type="button"
                  className="gn__btn gn__btn--ghost"
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                >
                  {signOutLabel}
                </button>
              </>
            ) : (
              <Link
                className="gn__btn gn__btn--ghost"
                href="/login"
                onClick={() => setMenuOpen(false)}
              >
                {t('nav.login')}
              </Link>
            )}
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
