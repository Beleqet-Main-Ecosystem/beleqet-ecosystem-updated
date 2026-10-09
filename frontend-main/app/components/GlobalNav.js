'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '../../lib/i18n';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://beleqetjobs.com';

const PRIMARY_NAV = [
  { key: 'nav.findJobs', href: '/jobs' },
  { key: 'nav.freelance', href: '/freelance' },
  { key: 'nav.forEmployers', href: '/for-employers' },
  { key: 'nav.pricing', href: '/pricing' },
];

const MORE_NAV = [
  { key: 'nav.cvMaker', href: '/cv-maker' },
  { key: 'nav.portfolio', href: '/portfolio' },
  { key: 'nav.chatToText', href: '/chat-to-text' },
  { key: 'nav.about', href: '/about' },
];

const ALL_DRAWER_NAV = [...PRIMARY_NAV, ...MORE_NAV];

export default function GlobalNav() {
  const { t, locale, setLocale } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    const saved = localStorage.getItem('bq-theme');
    if (saved === 'dark') setDark(true);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('bq-theme', dark ? 'dark' : 'light');
  }, [dark]);

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

  // Dropdown close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  return (
    <header className={`gn${scrolled ? ' gn--scrolled' : ''}`} id="site-nav" role="banner">
      <div className="gn__inner">
        {/* ── Logo ── */}
        <Link href="/" className="gn__brand" aria-label="Beleqet Jobs home">
          <span
            className="gn__logo-dot"
            aria-hidden="true"
            style={{
              background: 'transparent',
              padding: 0,
              overflow: 'hidden',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <img
              src="/logo-icon.png"
              alt="Beleqet"
              width="34"
              height="34"
              style={{ borderRadius: '8px', objectFit: 'contain' }}
            />
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
          {PRIMARY_NAV.map(({ key, href }) => (
            <Link key={href} href={href} className="gn__link">
              {t(key)}
            </Link>
          ))}

          {/* Tools dropdown */}
          <div className="gn__dropdown-wrap" ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="gn__link"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0,
              }}
            >
              <span>{locale === 'am' ? 'ተጨማሪ' : 'Tools'}</span>
              <span
                style={{
                  fontSize: '9px',
                  display: 'inline-block',
                  transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform .2s',
                }}
              >
                ▼
              </span>
            </button>
            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '-10px',
                  marginTop: '12px',
                  background: 'var(--green-hero, #002b1b)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  padding: '6px',
                  minWidth: '160px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
                  zIndex: 60,
                  backdropFilter: 'blur(10px)',
                }}
              >
                {MORE_NAV.map(({ key, href }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'block',
                      padding: '8px 12px',
                      color: 'rgba(255,255,255,0.85)',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {t(key)}
                  </Link>
                ))}
              </div>
            )}
          </div>
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

          {/* Conditional Login/SignUp vs User Dashboard */}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <a
                className="gn__btn gn__btn--ghost"
                href={`${APP_URL}/profile`}
                style={{ fontWeight: 600 }}
              >
                {user.firstName ? user.firstName : locale === 'am' ? 'መለያ' : 'Dashboard'}
              </a>
              <button
                className="gn__btn gn__btn--ghost"
                onClick={handleLogout}
                style={{ cursor: 'pointer' }}
              >
                {locale === 'am' ? 'ውጣ' : 'Sign Out'}
              </button>
            </div>
          ) : (
            <>
              <Link className="gn__btn gn__btn--ghost" href="/login">
                {t('nav.login')}
              </Link>
              <Link className="gn__btn gn__btn--ghost" href="/login?tab=signup">
                {t('nav.signUp')}
              </Link>
            </>
          )}

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
          {ALL_DRAWER_NAV.map(({ key, href }) => (
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
            {user ? (
              <>
                <a
                  className="gn__btn gn__btn--ghost"
                  href={`${APP_URL}/profile`}
                  onClick={() => setMenuOpen(false)}
                >
                  {user.firstName ? user.firstName : locale === 'am' ? 'መለያ' : 'Dashboard'}
                </a>
                <button
                  className="gn__btn gn__btn--ghost"
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                >
                  {locale === 'am' ? 'ውጣ' : 'Sign Out'}
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
