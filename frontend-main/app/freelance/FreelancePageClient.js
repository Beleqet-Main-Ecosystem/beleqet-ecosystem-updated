'use client';

import { useState } from 'react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://beleqetjobs.com';

const CATEGORIES = [
  { slug: 'all', label: 'All Gigs' },
  { slug: 'graphic-design', label: 'Graphic Design' },
  { slug: 'web-app-dev', label: 'Web & App Dev' },
  { slug: 'writing-translation', label: 'Writing & Translation' },
  { slug: 'video-animation', label: 'Video & Animation' },
  { slug: 'digital-marketing', label: 'Digital Marketing' },
  { slug: 'bookkeeping', label: 'Bookkeeping' },
  { slug: 'data-entry', label: 'Data Entry' },
  { slug: 'photography', label: 'Photography' },
];

const FALLBACK_GIGS = [
  {
    id: '1',
    title: 'Logo & Brand Identity Kit',
    category: 'graphic-design',
    budget: '3,500–6,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'Boutique Roastery',
    skills: ['Illustrator', 'Branding'],
    posted: '2h ago',
    escrow: true,
  },
  {
    id: '2',
    title: 'React Native App Bug Fixes',
    category: 'web-app-dev',
    budget: '300–500',
    budgetUnit: 'ETB/hr',
    type: 'Hourly',
    client: 'FinTech Startup',
    skills: ['React Native', 'TypeScript'],
    posted: '5h ago',
    escrow: true,
  },
  {
    id: '3',
    title: 'Amharic–English Document Translation',
    category: 'writing-translation',
    budget: '2,000–3,500',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'NGO Ethiopia',
    skills: ['Amharic', 'English'],
    posted: '1d ago',
    escrow: true,
  },
  {
    id: '4',
    title: 'Product Explainer Video (60s)',
    category: 'video-animation',
    budget: '8,000–14,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'EdTech Company',
    skills: ['After Effects', 'Motion'],
    posted: '3h ago',
    escrow: true,
  },
  {
    id: '5',
    title: 'Social Media Content Calendar — 30 Days',
    category: 'digital-marketing',
    budget: '4,000–7,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'FMCG Brand',
    skills: ['Canva', 'Copywriting'],
    posted: '6h ago',
    escrow: true,
  },
  {
    id: '6',
    title: 'Monthly Bookkeeping & Reporting',
    category: 'bookkeeping',
    budget: '3,000',
    budgetUnit: 'ETB/mo',
    type: 'Retainer',
    client: 'Small Retailer',
    skills: ['QuickBooks', 'Excel'],
    posted: '12h ago',
    escrow: true,
  },
  {
    id: '7',
    title: 'E-commerce Website (WooCommerce)',
    category: 'web-app-dev',
    budget: '12,000–20,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'Fashion Store',
    skills: ['WordPress', 'WooCommerce'],
    posted: '2d ago',
    escrow: true,
  },
  {
    id: '8',
    title: 'Product Photography — 20 SKUs',
    category: 'photography',
    budget: '5,000–9,000',
    budgetUnit: 'ETB',
    type: 'Fixed',
    client: 'Cosmetics Brand',
    skills: ['Photography', 'Lightroom'],
    posted: '1d ago',
    escrow: true,
  },
  {
    id: '9',
    title: 'Data Entry & CRM Clean-Up',
    category: 'data-entry',
    budget: '150–200',
    budgetUnit: 'ETB/hr',
    type: 'Hourly',
    client: 'Insurance Co.',
    skills: ['Excel', 'HubSpot'],
    posted: '4h ago',
    escrow: false,
  },
];

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const CAT_COLORS = ['#123626', '#1B4A33', '#0E2C1E', '#183D2A', '#123626'];
const catColor = (i) => CAT_COLORS[i % CAT_COLORS.length];

function GigCard({ gig, i }) {
  const [saved, setSaved] = useState(false);
  return (
    <a href={`${APP_URL}/freelance/${gig.id}`} className="gig-card" aria-label={gig.title}>
      <div className="gc-top">
        <span className="gc-chip" style={{ background: catColor(i) }}>
          {initials(gig.title)}
        </span>
        <button
          className={`gc-save${saved ? ' saved' : ''}`}
          aria-label="Save gig"
          onClick={(e) => {
            e.preventDefault();
            setSaved((s) => !s);
          }}
        >
          <svg viewBox="0 0 24 24">
            <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
          </svg>
        </button>
      </div>
      <h3 className="gc-title">{gig.title}</h3>
      <p className="gc-client">{gig.client}</p>
      <div className="gc-skills">
        {gig.skills.map((s) => (
          <span key={s} className="gc-skill">
            {s}
          </span>
        ))}
      </div>
      <div className="gc-footer">
        <div className="gc-budget">
          <b>{gig.budget}</b>
          <span>{gig.budgetUnit}</span>
        </div>
        <div className="gc-meta">
          <span className={`gc-type gc-type--${gig.type.toLowerCase()}`}>{gig.type}</span>
          {gig.escrow && (
            <span className="gc-escrow" title="Escrow protected">
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5z" />
              </svg>
              Escrow
            </span>
          )}
          <span className="gc-posted">{gig.posted}</span>
        </div>
      </div>
    </a>
  );
}

export default function FreelancePageClient({ gigs = [] }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const allGigs = gigs.length > 0 ? gigs : FALLBACK_GIGS;

  const filtered = allGigs.filter((g) => {
    const matchCat = activeCategory === 'all' || g.category === activeCategory;
    const q = search.toLowerCase();
    const matchQ =
      !q ||
      g.title.toLowerCase().includes(q) ||
      g.client.toLowerCase().includes(q) ||
      g.skills?.some((s) => s.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  return (
    <main className="fl-page">
      {/* ── Hero band ── */}
      <div className="fl-hero">
        <div className="fl-hero__inner">
          <div className="fl-hero__copy">
            <div className="sec-eyebrow" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Freelance Marketplace
            </div>
            <h1 className="fl-hero__h">
              Hire Ethiopian Talent.
              <br />
              Get Paid <span className="fl-accent">Safely</span>.
            </h1>
            <p className="fl-hero__sub">
              Post projects or find freelance gigs — all payments protected by BeleqetSafe Escrow.
              ክፍያ በ Escrow የተጠበቀ ፊሪላንስ ማርኬትፕሌስ።
            </p>
            <div className="fl-hero__btns">
              <a className="btn btn-lime" href={`${APP_URL}/post-project`}>
                Post a Project
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <a className="btn btn-outline-hero" href={`${APP_URL}/freelance/register`}>
                Become a Freelancer
              </a>
            </div>
          </div>
          {/* Escrow trust badge */}
          <div className="fl-escrow-card">
            <div className="fl-ec-icon">
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5z" />
              </svg>
            </div>
            <h3>BeleqetSafe Escrow</h3>
            <p>
              Client funds are held securely until you approve the work. Released instantly via
              Chapa or Telebirr.
            </p>
            <div className="fl-ec-steps">
              {[
                ['1', 'Client posts project'],
                ['2', 'Funds locked in escrow'],
                ['3', 'Work delivered & approved'],
                ['4', 'Payout to your account'],
              ].map(([n, label]) => (
                <div key={n} className="fl-ec-step">
                  <span className="fl-ec-num">{n}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="fl-ec-stats">
              <div>
                <b>98%</b>
                <span>on-time payouts</span>
              </div>
              <div>
                <b>0%</b>
                <span>payment disputes lost</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Feed ── */}
      <div className="fl-feed">
        <div className="fl-feed__inner">
          {/* Search + sort bar */}
          <div className="fl-toolbar">
            <div className="fl-search">
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Search gigs, skills, or clients…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search freelance gigs"
              />
            </div>
            <select
              className="fl-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort gigs"
            >
              <option value="recent">Most Recent</option>
              <option value="budget-high">Highest Budget</option>
              <option value="budget-low">Lowest Budget</option>
            </select>
          </div>

          {/* Category filters */}
          <div className="fl-cats" role="tablist" aria-label="Filter by category">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.slug}
                role="tab"
                aria-selected={activeCategory === cat.slug}
                className={`fl-cat${activeCategory === cat.slug ? ' fl-cat--active' : ''}`}
                onClick={() => setActiveCategory(cat.slug)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Results count */}
          <div className="fl-results-count">
            <b>{filtered.length}</b> gig{filtered.length !== 1 ? 's' : ''} found
            {activeCategory !== 'all' && (
              <span>
                {' '}
                in <em>{CATEGORIES.find((c) => c.slug === activeCategory)?.label}</em>
              </span>
            )}
          </div>

          {/* Gig grid */}
          {filtered.length > 0 ? (
            <div className="fl-grid">
              {filtered.map((gig, i) => (
                <GigCard key={gig.id} gig={gig} i={i} />
              ))}
            </div>
          ) : (
            <div className="fl-empty">
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <p>No gigs found. Try a different category or search term.</p>
            </div>
          )}

          {/* Post project CTA */}
          <div className="fl-post-cta">
            <div>
              <h3>Have a project in mind?</h3>
              <p>
                Post it free and get proposals from verified Ethiopian freelancers within hours.
              </p>
            </div>
            <a className="btn btn-dark" href={`${APP_URL}/post-project`}>
              Post a Project Free
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
