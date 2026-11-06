'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { useTranslation } from './old-home-i18n';

const NAV = [
  { key: 'nav.findJobs', href: '/jobs' },
  { key: 'nav.freelance', href: '/freelance' },
  { key: 'nav.cvMaker', href: '/cv-maker' },
  { key: 'nav.pricing', href: '/pricing' },
  { key: 'nav.contact', href: '/contact' },
];

/** The earlier landing page's header: white bar, five links, Login and a dark Post a Job button. */
export default function OldHomeHeader() {
  const { t, locale, setLocale } = useTranslation();
  const { user, ready, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const signedIn = ready && Boolean(user);
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

          {signedIn ? (
            <>
              <Link className="gn__btn gn__btn--ghost" href="/profile">
                {accountLabel}
              </Link>
              <button type="button" className="gn__btn gn__btn--ghost" onClick={logout}>
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
            {signedIn ? (
              <>
                <Link
                  className="gn__btn gn__btn--ghost"
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                >
                  {accountLabel}
                </Link>
                <button
                  type="button"
                  className="gn__btn gn__btn--ghost"
                  onClick={() => {
                    logout();
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
