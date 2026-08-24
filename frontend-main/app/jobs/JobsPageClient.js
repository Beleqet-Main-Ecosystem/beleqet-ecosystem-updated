'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.beleqetjobs.com/api/v1';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://beleqetjobs.com';

const JOB_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
  { value: 'REMOTE', label: 'Remote' },
];

const LOCATIONS = [
  'All Locations',
  'Addis Ababa',
  'Dire Dawa',
  'Mekelle',
  'Gondar',
  'Hawassa',
  'Bahir Dar',
  'Adama',
  'Remote',
];

const FALLBACK_JOBS = [
  {
    id: '1',
    title: 'Senior Software Engineer',
    company: { name: 'Safaricom Ethiopia', logo: null },
    location: 'Addis Ababa',
    type: 'FULL_TIME',
    salaryMin: 45000,
    salaryMax: 70000,
    currency: 'ETB',
    category: { name: 'Technology' },
    postedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    featured: true,
  },
  {
    id: '2',
    title: 'Marketing Manager',
    company: { name: 'Ethiopian Airlines', logo: null },
    location: 'Addis Ababa',
    type: 'FULL_TIME',
    salaryMin: 30000,
    salaryMax: 50000,
    currency: 'ETB',
    category: { name: 'Marketing' },
    postedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    featured: false,
  },
  {
    id: '3',
    title: 'Financial Analyst',
    company: { name: 'Commercial Bank of Ethiopia', logo: null },
    location: 'Addis Ababa',
    type: 'FULL_TIME',
    salaryMin: 28000,
    salaryMax: 42000,
    currency: 'ETB',
    category: { name: 'Finance' },
    postedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    featured: false,
  },
  {
    id: '4',
    title: 'UX/UI Designer',
    company: { name: 'Kifiya Financial Technology', logo: null },
    location: 'Addis Ababa',
    type: 'FULL_TIME',
    salaryMin: 35000,
    salaryMax: 55000,
    currency: 'ETB',
    category: { name: 'Design' },
    postedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    featured: true,
  },
  {
    id: '5',
    title: 'Data Analyst',
    company: { name: 'Ethiotelecom', logo: null },
    location: 'Addis Ababa',
    type: 'FULL_TIME',
    salaryMin: 25000,
    salaryMax: 38000,
    currency: 'ETB',
    category: { name: 'Technology' },
    postedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    featured: false,
  },
  {
    id: '6',
    title: 'Content Writer (Remote)',
    company: { name: 'Beleqet Media', logo: null },
    location: 'Remote',
    type: 'REMOTE',
    salaryMin: 15000,
    salaryMax: 22000,
    currency: 'ETB',
    category: { name: 'Media' },
    postedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    featured: false,
  },
  {
    id: '7',
    title: 'Civil Engineer',
    company: { name: 'Sunshine Construction', logo: null },
    location: 'Dire Dawa',
    type: 'FULL_TIME',
    salaryMin: 32000,
    salaryMax: 48000,
    currency: 'ETB',
    category: { name: 'Engineering' },
    postedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    featured: false,
  },
  {
    id: '8',
    title: 'Human Resources Officer',
    company: { name: 'Heineken Ethiopia', logo: null },
    location: 'Addis Ababa',
    type: 'FULL_TIME',
    salaryMin: 22000,
    salaryMax: 34000,
    currency: 'ETB',
    category: { name: 'HR' },
    postedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    featured: false,
  },
  {
    id: '9',
    title: 'Frontend Developer (React)',
    company: { name: 'YaYa Wallet', logo: null },
    location: 'Addis Ababa',
    type: 'FULL_TIME',
    salaryMin: 38000,
    salaryMax: 60000,
    currency: 'ETB',
    category: { name: 'Technology' },
    postedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    featured: false,
  },
];

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return '1d ago';
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function formatSalary(min, max, currency) {
  if (!min && !max) return null;
  const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : String(n));
  if (min && max) return `${fmt(min)}–${fmt(max)} ${currency || 'ETB'}`;
  if (min) return `${fmt(min)}+ ${currency || 'ETB'}`;
  return `Up to ${fmt(max)} ${currency || 'ETB'}`;
}

function typeBadgeClass(type) {
  const map = {
    FULL_TIME: 'jb-type--full',
    PART_TIME: 'jb-type--part',
    CONTRACT: 'jb-type--contract',
    INTERNSHIP: 'jb-type--intern',
    REMOTE: 'jb-type--remote',
  };
  return map[type] || 'jb-type--full';
}

function typeLabel(type) {
  const map = {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    CONTRACT: 'Contract',
    INTERNSHIP: 'Internship',
    REMOTE: 'Remote',
  };
  return map[type] || type;
}

function CompanyInitials({ name }) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return <span className="jb-initials">{initials}</span>;
}

function JobCard({ job }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.currency);
  return (
    <a
      href={`${APP_URL}/jobs/${job.id}`}
      className={`job-card${job.featured ? ' job-card--featured' : ''}`}
      aria-label={`${job.title} at ${job.company?.name}`}
    >
      {job.featured && <span className="jb-featured-badge">Featured</span>}
      <div className="jb-top">
        <div className="jb-logo">
          {job.company?.logo ? (
            <img src={job.company.logo} alt={job.company.name} width={40} height={40} />
          ) : (
            <CompanyInitials name={job.company?.name} />
          )}
        </div>
        <div className="jb-info">
          <h3 className="jb-title">{job.title}</h3>
          <span className="jb-company">{job.company?.name}</span>
        </div>
      </div>
      <div className="jb-meta">
        <span className="jb-location">
          <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          {job.location}
        </span>
        {job.category?.name && <span className="jb-category">{job.category.name}</span>}
        <span className={`jb-type ${typeBadgeClass(job.type)}`}>{typeLabel(job.type)}</span>
      </div>
      <div className="jb-footer">
        {salary ? (
          <span className="jb-salary">{salary} / mo</span>
        ) : (
          <span className="jb-salary jb-salary--hidden">Salary not disclosed</span>
        )}
        <span className="jb-posted">{timeAgo(job.postedAt || job.createdAt)}</span>
      </div>
    </a>
  );
}

export default function JobsPageClient({ initialJobs = [], initialTotal = 0 }) {
  const [jobs, setJobs] = useState(initialJobs.length > 0 ? initialJobs : FALLBACK_JOBS);
  const [total, setTotal] = useState(initialTotal || FALLBACK_JOBS.length);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 12;

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, page });
      if (search) params.set('q', search);
      if (type) params.set('type', type);
      if (location && location !== 'All Locations') params.set('location', location);

      const res = await fetch(`${API}/jobs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.items ?? data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      // keep existing data on network error
    } finally {
      setLoading(false);
    }
  }, [search, type, location, page]);

  // Only fetch from API after mount (skip on SSR fallback data)
  useEffect(() => {
    if (initialJobs.length > 0) return; // SSR already loaded
    fetchJobs();
  }, [fetchJobs, initialJobs.length]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchJobs();
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <main className="jobs-page">
      {/* ── Hero search band ── */}
      <div className="jobs-hero">
        <div className="jobs-hero__inner">
          <div className="sec-eyebrow" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Jobs & Vacancies
          </div>
          <h1 className="jobs-hero__h">
            Find your next opportunity
            <br />
            <span style={{ color: 'var(--lime)' }}>across Ethiopia and beyond.</span>
          </h1>
          <p className="jobs-hero__sub">
            Thousands of verified full-time, part-time, remote, and contract jobs — updated daily.
            <br />
            ከሙሉ ጊዜ ስራዎች እስከ ሪሞት እና ኮንትራት — ዕለት ዕለት ይዘምናሉ።
          </p>

          {/* Search bar */}
          <form className="jobs-search-bar" onSubmit={handleSearch} role="search">
            <div className="jsb-field jsb-field--q">
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                placeholder="Job title, keyword, or company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search jobs"
              />
            </div>
            <div className="jsb-field jsb-field--loc">
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                aria-label="Filter by location"
              >
                {LOCATIONS.map((l) => (
                  <option key={l} value={l === 'All Locations' ? '' : l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-lime jsb-submit" type="submit">
              Search Jobs
            </button>
          </form>
        </div>
      </div>

      {/* ── Feed ── */}
      <div className="jobs-feed">
        <div className="jobs-feed__inner">
          {/* Filters row */}
          <div className="jobs-filters">
            <div className="jf-left">
              <span className="jf-count">
                <b>{total.toLocaleString()}</b> job{total !== 1 ? 's' : ''} found
                {location && location !== 'All Locations' && ` in ${location}`}
                {search && ` for "${search}"`}
              </span>
            </div>
            <div className="jf-right">
              <span className="jf-label">Type:</span>
              {JOB_TYPES.map((t) => (
                <button
                  key={t.value}
                  className={`jf-chip${type === t.value ? ' jf-chip--active' : ''}`}
                  onClick={() => {
                    setType(t.value);
                    setPage(1);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="jobs-loading" aria-live="polite">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="job-card job-card--skeleton" aria-hidden="true">
                  <div className="sk-row">
                    <div className="sk-circle" />
                    <div className="sk-lines">
                      <div className="sk-line sk-line--wide" />
                      <div className="sk-line sk-line--narrow" />
                    </div>
                  </div>
                  <div className="sk-line sk-line--mid" />
                  <div className="sk-line sk-line--narrow" />
                </div>
              ))}
            </div>
          ) : jobs.length > 0 ? (
            <div className="jobs-grid">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="jobs-empty">
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <p>No jobs found. Try different keywords or clear your filters.</p>
              <button
                className="btn btn-dark"
                onClick={() => {
                  setSearch('');
                  setType('');
                  setLocation('');
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="jobs-pagination">
              <button
                className="jp-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
              >
                ←
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className={`jp-btn${page === p ? ' jp-btn--active' : ''}`}
                    onClick={() => setPage(p)}
                    aria-label={`Page ${p}`}
                    aria-current={page === p ? 'page' : undefined}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="jp-btn"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                →
              </button>
            </div>
          )}

          {/* Post CTA */}
          <div className="jobs-post-cta">
            <div>
              <h3>Are you hiring?</h3>
              <p>Post a job and reach thousands of qualified Ethiopian professionals today.</p>
            </div>
            <Link className="btn btn-dark" href="/post-job">
              Post a Job Free
              <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
