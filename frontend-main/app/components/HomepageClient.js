'use client';

import { useEffect } from 'react';
import { buildSearchUrl } from '../../lib/api';

/**
 * HomepageClient — all interactive/animation logic.
 * Receives live data as props from the Server Component (page.js).
 *
 * @param {{ featuredJobs: object[], featuredGigs: object[], stats: object, appUrl: string }} props
 */
export default function HomepageClient({ featuredJobs, featuredGigs, stats, appUrl }) {
  useEffect(() => {
    /* ---------- helpers ---------- */
    function initials(name) {
      return (name || '?')
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('');
    }
    const chipColors = ['#123626', '#1B4A33', '#123626', '#0E2C1E', '#123626'];
    const chipColor = (i) => chipColors[i % chipColors.length];

    /* ---------- nav scroll ---------- */
    const navEl = document.getElementById('site-nav');
    const onScroll = () => navEl && navEl.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll);

    /* ---------- hero board (live jobs / gigs rotating display) ---------- */
    const boardJobs = featuredJobs.slice(0, 5).map((j) => ({
      role: j.title,
      co: j.company?.name ?? j.companyName ?? 'Company',
      pay: j.salaryMin
        ? `${j.salaryMin.toLocaleString()}–${(j.salaryMax || j.salaryMin).toLocaleString()}`
        : 'Competitive',
      unit: j.currency || 'ETB',
    }));
    const boardGigs = featuredGigs.slice(0, 5).map((g) => ({
      role: g.title,
      co: g.company?.name ?? g.companyName ?? 'Client',
      pay: g.salaryMin
        ? `${g.salaryMin.toLocaleString()}–${(g.salaryMax || g.salaryMin).toLocaleString()}`
        : 'Negotiable',
      unit: g.currency || 'ETB',
    }));

    // Fallback static data when API returns empty (e.g. fresh DB)
    const fallbackJobs = [
      {
        role: 'Senior Product Designer',
        co: 'Kifiya Financial Technology',
        pay: '12,000–18,000',
        unit: 'ETB',
      },
      { role: 'Frontend Engineer', co: 'PRAGMA Investment', pay: '25,000–35,000', unit: 'ETB' },
      { role: 'Marketing Lead', co: 'Dinsi Manufacturing', pay: '14,000–20,000', unit: 'ETB' },
      { role: 'Full Stack Developer', co: 'TakaCash', pay: '20,000–28,000', unit: 'ETB' },
      { role: 'HR & Admin Officer', co: 'Safaricom Ethiopia', pay: '11,000–16,000', unit: 'ETB' },
    ];
    const fallbackGigs = [
      {
        role: 'Logo Design for Coffee Brand',
        co: 'Boutique Roastery',
        pay: '3,500–6,000',
        unit: 'ETB',
      },
      { role: 'WordPress Bug Fixes', co: 'Retail Startup', pay: '250–400', unit: 'ETB/hr' },
      { role: 'Amharic–English Translation', co: 'NGO Project', pay: '2,000–3,500', unit: 'ETB' },
      { role: 'Social Media Content Calendar', co: 'FMCG Brand', pay: '4,000–7,000', unit: 'ETB' },
      { role: 'Monthly Bookkeeping', co: 'Small Retailer', pay: '3,000', unit: 'ETB/mo' },
    ];

    const liveJobs = boardJobs.length > 0 ? boardJobs : fallbackJobs;
    const liveGigs = boardGigs.length > 0 ? boardGigs : fallbackGigs;

    function rowHtml(item, i) {
      return `<div class="flip-inner">
        <span class="chip" style="background:${chipColor(i)};">${initials(item.role)}</span>
        <div class="role"><b>${item.role}</b><span>${item.co}</span></div>
        <div class="pay"><b>${item.pay}</b><span>${item.unit}</span></div>
      </div>`;
    }

    const boardEl = document.getElementById('board-rows');
    const ROWS = 3;
    const state = { pool: liveJobs.slice(), visible: liveJobs.slice(0, ROWS) };

    function renderBoard() {
      if (!boardEl) return;
      boardEl.innerHTML = state.visible
        .map((item, i) => `<div class="row" data-i="${i}">${rowHtml(item, i)}</div>`)
        .join('');
    }
    function staggerFlipIn() {
      document.querySelectorAll('#board-rows .row').forEach((r, i) => {
        setTimeout(() => {
          r.classList.add('flipping');
          setTimeout(() => r.classList.remove('flipping'), 650);
        }, i * 150);
      });
    }
    function setBoardMode(mode) {
      state.pool = mode === 'jobs' ? liveJobs.slice() : liveGigs.slice();
      state.visible = state.pool.slice(0, ROWS);
      renderBoard();
      staggerFlipIn();
    }
    setBoardMode('jobs');

    const boardInterval = setInterval(() => {
      if (!state.visible.length || !boardEl) return;
      const idx = Math.floor(Math.random() * state.visible.length);
      const rowEl = boardEl.querySelector(`.row[data-i="${idx}"]`);
      if (!rowEl) return;
      rowEl.classList.add('flipping');
      setTimeout(() => {
        const next = state.pool[Math.floor(Math.random() * state.pool.length)];
        state.visible[idx] = next;
        rowEl.querySelector('.flip-inner').innerHTML = rowHtml(next, idx).match(
          /<div class="flip-inner">([\s\S]*)<\/div>/,
        )[1];
      }, 300);
      setTimeout(() => rowEl.classList.remove('flipping'), 650);
    }, 3400);

    /* ---------- featured job cards ---------- */
    function timeAgo(dateStr) {
      if (!dateStr) return 'Recently';
      const diff = Date.now() - new Date(dateStr).getTime();
      const h = Math.floor(diff / 3600000);
      if (h < 1) return 'Just now';
      if (h < 24) return `${h}h ago`;
      return `${Math.floor(h / 24)}d ago`;
    }

    function typeLabel(type) {
      const map = {
        FULL_TIME: 'Full Time',
        PART_TIME: 'Part Time',
        REMOTE: 'Remote',
        HYBRID: 'Hybrid',
        CONTRACT: 'Contract',
      };
      return map[type] || type || 'Full Time';
    }
    function typeClass(type) {
      const map = {
        FULL_TIME: 'fulltime',
        PART_TIME: 'parttime',
        REMOTE: 'remote',
        HYBRID: 'hybrid',
        CONTRACT: 'contract',
      };
      return map[type] || 'fulltime';
    }

    function jobCard(item, i) {
      const role = item.title || item.role || 'Position';
      const co = item.company?.name || item.companyName || item.co || 'Company';
      const loc = item.location || item.loc || 'Ethiopia';
      const tc = typeClass(item.type);
      const tl = typeLabel(item.type);
      const time = timeAgo(item.createdAt);
      const jobUrl = item.id ? `${appUrl}/jobs/${item.id}` : `${appUrl}/jobs`;
      return `<a href="${jobUrl}" class="job-card" style="text-decoration:none;color:inherit;" aria-label="${role} at ${co}">
        <div class="jc-top">
          <span class="jc-chip" style="background:${chipColor(i)};">${initials(role)}</span>
          <button class="bookmark" aria-label="Save job" onclick="event.preventDefault();this.classList.toggle('saved')">
            <svg viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>
          </button>
        </div>
        <h4>${role}</h4>
        <p class="co">${co}</p>
        <p class="loc"><svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>${loc}</p>
        <div class="jc-bottom"><span class="type-tag ${tc}">${tl}</span><span class="posted">${time}</span></div>
      </a>`;
    }

    // Live data with fallback
    const displayJobs =
      featuredJobs.length > 0
        ? featuredJobs
        : [
            {
              role: 'Full Stack Developer',
              companyName: 'TakaCash',
              location: 'Addis Ababa',
              type: 'FULL_TIME',
              createdAt: null,
            },
            {
              role: 'Digital Marketing Specialist',
              companyName: 'ethio telecom',
              location: 'Addis Ababa',
              type: 'HYBRID',
              createdAt: null,
            },
            {
              role: 'Customer Service Agent',
              companyName: 'Dashen Bank',
              location: 'Addis Ababa',
              type: 'FULL_TIME',
              createdAt: null,
            },
            {
              role: 'Graphic Designer',
              companyName: 'System One',
              location: 'Remote',
              type: 'REMOTE',
              createdAt: null,
            },
            {
              role: 'HR & Admin Officer',
              companyName: 'Safaricom Ethiopia',
              location: 'Addis Ababa',
              type: 'FULL_TIME',
              createdAt: null,
            },
          ];
    const displayGigs =
      featuredGigs.length > 0
        ? featuredGigs
        : [
            {
              role: 'Logo & Brand Kit',
              companyName: 'Boutique Roastery',
              location: 'Fixed price',
              type: 'CONTRACT',
              createdAt: null,
            },
            {
              role: 'WordPress Bug Fixes',
              companyName: 'Retail Startup',
              location: 'Hourly',
              type: 'CONTRACT',
              createdAt: null,
            },
            {
              role: 'Translation, 20 Pages',
              companyName: 'NGO Project',
              location: 'Fixed price',
              type: 'CONTRACT',
              createdAt: null,
            },
            {
              role: 'Explainer Video Edit',
              companyName: 'EdTech Startup',
              location: 'Fixed price',
              type: 'CONTRACT',
              createdAt: null,
            },
            {
              role: 'Monthly Bookkeeping',
              companyName: 'Small Retailer',
              location: 'Retainer',
              type: 'CONTRACT',
              createdAt: null,
            },
          ];

    const jobsEl = document.getElementById('featured-jobs');
    const gigsEl = document.getElementById('featured-gigs');
    if (jobsEl) jobsEl.innerHTML = displayJobs.map(jobCard).join('');
    if (gigsEl) gigsEl.innerHTML = displayGigs.map(jobCard).join('');

    /* ---------- search bar ---------- */
    let currentMode = 'jobs';
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const q = document.getElementById('search-q')?.value ?? '';
        const loc = document.getElementById('search-loc')?.value ?? '';
        window.location.href = buildSearchUrl(q, loc, currentMode);
      });
    }
    // Also submit on Enter in inputs
    ['search-q', 'search-loc'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const q = document.getElementById('search-q')?.value ?? '';
            const loc = document.getElementById('search-loc')?.value ?? '';
            window.location.href = buildSearchUrl(q, loc, currentMode);
          }
        });
      }
    });

    /* ---------- popular search chips ---------- */
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-chip')) {
        const q = e.target.textContent.trim();
        window.location.href = buildSearchUrl(q, '', currentMode);
      }
    });

    /* ---------- hero mode toggle ---------- */
    const modeContent = {
      jobs: {
        h1: 'Find Your Next <span class="accent">Opportunity</span> Faster.',
        subAm: 'በሺዎች የሚቆጠሩ የተረጋገጡ የስራ እድሎችን በኢትዮጵያ ውስጥ ያግኙ።',
        subEn:
          'Discover thousands of verified job opportunities across Ethiopia. Search, apply, and get hired faster with the Beleqet Vacancy Platform.',
        qPlaceholder: 'Job title, keyword or company',
        locPlaceholder: 'Location e.g. Addis Ababa',
        btnText: 'Search Jobs',
        popular: ['Developer', 'Marketing', 'Designer', 'Accounting', 'Sales', 'Remote'],
        trust: [
          ['Verified &amp; Trusted', '100% verified job listings'],
          ['Real-time Alerts', 'Get instant job updates'],
          ['Telegram Notifications', 'Never miss an opportunity'],
        ],
        boardTitle: 'Fresh opportunities',
        boardBadge: `${stats.activeJobs?.toLocaleString() ?? '24'} new`,
        boardFoot: 'Explore all openings →',
        fbTitle: 'New Job Alert',
        fbSub: 'UI/UX Designer · Addis Ababa',
        floatStatValue: '3.2×',
        floatStatLabel: 'more profile views',
        navCta: 'Post a Job',
        navCtaHref: `${appUrl}/post-job`,
      },
      freelance: {
        h1: 'Get Your Next <span class="accent">Project</span> Paid Safely.',
        subAm: 'ክፍያ በ Escrow የተጠበቀ፣ ደንበኛ ወይም ፊሪላንሰርን በቀጥታ ያግኙ።',
        subEn:
          'Post projects to verified Ethiopian clients, get paid safely through escrow, and grow your freelance career with confidence.',
        qPlaceholder: 'What do you need done',
        locPlaceholder: 'Budget range',
        btnText: 'Find Talent',
        popular: ['Design', 'Writing', 'Web Dev', 'Video', 'Marketing', 'Bookkeeping'],
        trust: [
          ['Escrow Protected', 'Funds held until you approve'],
          ['Verified Freelancers', 'Portfolios &amp; real ratings'],
          ['Chapa &amp; Telebirr', 'Local payouts, no delay'],
        ],
        boardTitle: 'Fresh gigs',
        boardBadge: '18 new',
        boardFoot: 'Explore all live gigs →',
        fbTitle: 'New Gig Alert',
        fbSub: 'Logo Design · Remote',
        floatStatValue: '98%',
        floatStatLabel: 'on-time payouts',
        navCta: 'Post a Project',
        navCtaHref: `${appUrl}/post-project`,
      },
    };

    function moveIndicator(btn) {
      const ind = document.getElementById('mode-indicator');
      if (!ind || !btn) return;
      ind.style.width = btn.offsetWidth + 'px';
      ind.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
    }

    function applyMode(mode) {
      currentMode = mode;
      const c = modeContent[mode];
      const wrap = document.getElementById('hero-copy');
      if (wrap) wrap.classList.add('is-switching');
      setTimeout(() => {
        const set = (id, prop, val) => {
          const el = document.getElementById(id);
          if (el) el[prop] = val;
        };
        const setHTML = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = val;
        };
        setHTML('hero-h', c.h1);
        set('hero-sub-am', 'textContent', c.subAm);
        set('hero-sub-en', 'textContent', c.subEn);
        set('search-q', 'placeholder', c.qPlaceholder);
        set('search-loc', 'placeholder', c.locPlaceholder);
        const btn = document.getElementById('search-btn');
        if (btn) btn.childNodes[0].textContent = c.btnText + ' ';
        setHTML(
          'popular-wrap',
          '<span>Popular Searches:</span>' +
            c.popular.map((t) => `<span class="tag-chip">${t}</span>`).join(''),
        );
        set('tc1-b', 'innerHTML', c.trust[0][0]);
        set('tc1-s', 'innerHTML', c.trust[0][1]);
        set('tc2-b', 'innerHTML', c.trust[1][0]);
        set('tc2-s', 'innerHTML', c.trust[1][1]);
        set('tc3-b', 'innerHTML', c.trust[2][0]);
        set('tc3-s', 'innerHTML', c.trust[2][1]);
        if (wrap) wrap.classList.remove('is-switching');
      }, 260);
      const setT = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setT('board-title', c.boardTitle);
      setT('board-new-badge', c.boardBadge);
      setT('board-foot-text', c.boardFoot);
      setT('fb-title', c.fbTitle);
      setT('fb-sub', c.fbSub);
      setT('float-stat-value', c.floatStatValue);
      setT('float-stat-label', c.floatStatLabel);
      setT('nav-cta', c.navCta);
      const navCta = document.getElementById('nav-cta');
      if (navCta) navCta.href = c.navCtaHref;

      document
        .querySelectorAll('.mode-toggle button')
        .forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
      moveIndicator(document.getElementById(mode === 'jobs' ? 'btn-jobs' : 'btn-freelance'));
      setBoardMode(mode);
    }

    const toggleHandlers = Array.from(document.querySelectorAll('.mode-toggle button')).map((b) => {
      const handler = () => applyMode(b.dataset.mode);
      b.addEventListener('click', handler);
      return { b, handler };
    });
    moveIndicator(document.getElementById('btn-jobs'));
    // Initialise badge with live count
    const badgeEl = document.getElementById('board-new-badge');
    if (badgeEl && stats.activeJobs)
      badgeEl.textContent = `${stats.activeJobs.toLocaleString()} new`;

    /* ---------- stat count-up (uses live values from props) ---------- */
    const statMap = {
      activeJobs: stats.activeJobs ?? 10000,
      hiringCompanies: stats.hiringCompanies ?? 5000,
      registeredJobSeekers: stats.registeredJobSeekers ?? 50000,
      satisfactionRate: stats.satisfactionRate ?? 98,
    };
    const statTargets = [
      'activeJobs',
      'hiringCompanies',
      'registeredJobSeekers',
      'satisfactionRate',
    ];

    function animateCount(el) {
      const key = el.dataset.statKey;
      const target = key
        ? (statMap[key] ?? parseInt(el.dataset.target, 10))
        : parseInt(el.dataset.target, 10);
      const suffix = el.dataset.suffix || '';
      const dur = 1400;
      const start = performance.now();
      function tick(now) {
        const p = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    const statIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            document
              .querySelectorAll('#stats-row b[data-stat-key], #stats-row b[data-target]')
              .forEach(animateCount);
            statIo.disconnect();
          }
        });
      },
      { threshold: 0.3 },
    );
    const statsRow = document.getElementById('stats-row');
    if (statsRow) statIo.observe(statsRow);

    /* ---------- trusted companies marquee ---------- */
    const companies = [
      'Super SGS Trading',
      'Habesha Retail Group',
      'Merkato Foods',
      'Addis Logistics Co.',
      'Sheba Telecom',
      'Blue Nile Finance',
      'Kaffa Media House',
      'Entoto Manufacturing',
      'Rift Valley Agro',
      'Awash Bank Group',
    ];
    function logoBadge(name) {
      return `<div class="logo-badge"><span class="mono">${initials(name)}</span><b>${name}</b></div>`;
    }
    const logoTrack = document.getElementById('logo-track');
    if (logoTrack) {
      const logoHtml = companies.map(logoBadge).join('');
      logoTrack.innerHTML = logoHtml + logoHtml;
    }

    /* ---------- testimonials marquee ---------- */
    const testimonials = [
      {
        q: 'I found a marketing job with the salary listed upfront — no back and forth. Applied directly and started two weeks later.',
        n: 'Selamawit T.',
        r: 'Digital Marketing Officer, Addis Ababa',
        tag: 'job',
      },
      {
        q: 'My payment sat safely in escrow until I delivered the logo — released to Telebirr the same evening.',
        n: 'Selam H.',
        r: 'Freelance Graphic Designer',
        tag: 'freelance',
      },
      {
        q: "Every other site buried the pay range. Beleqet showed it right on the card — that's the whole reason I trust it.",
        n: 'Yonas B.',
        r: 'Accountant, Addis Ababa',
        tag: 'job',
      },
      {
        q: 'We hired a freelance developer for a two-week fix. Escrow meant we could pay upfront without worrying.',
        n: 'Abel N.',
        r: 'Founder, hiring on Beleqet Freelance',
        tag: 'freelance',
      },
      {
        q: 'The Telegram alert caught a listing an hour after it posted. I was the third applicant by lunchtime.',
        n: 'Bethelhem A.',
        r: 'Customer Service Rep, Adama',
        tag: 'job',
      },
      {
        q: "Amharic first, not an afterthought. It's the first platform that actually reads like it was built for us.",
        n: 'Dawit K.',
        r: 'Frontend Developer, Remote',
        tag: 'job',
      },
    ];
    function testiCard(t) {
      return `<div class="t-card"><span class="t-tag ${t.tag}">${t.tag === 'job' ? 'JOB' : 'FREELANCE'}</span><span class="qmark">&ldquo;</span><p class="quote">${t.q}</p><div class="who"><div class="avatar">${initials(t.n)}</div><div><b>${t.n}</b><span>${t.r}</span></div></div></div>`;
    }
    const testiTrack = document.getElementById('testi-track');
    if (testiTrack) {
      const html = testimonials.map(testiCard).join('');
      testiTrack.innerHTML = html + html;
    }

    /* ---------- scroll reveal ---------- */
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener('scroll', onScroll);
      clearInterval(boardInterval);
      toggleHandlers.forEach(({ b, handler }) => b.removeEventListener('click', handler));
      statIo.disconnect();
      io.disconnect();
    };
  }, [featuredJobs, featuredGigs, stats, appUrl]);

  const APP_URL = appUrl || 'https://beleqetjobs.com';

  return (
    <>
      <div className="hero-shell">
        <section className="hero" style={{ paddingTop: '44px' }}>
          <div id="hero-copy">
            <div className="mode-toggle" id="mode-toggle">
              <span className="indicator" id="mode-indicator"></span>
              <button className="active" data-mode="jobs" id="btn-jobs">
                Jobs · ስራ
              </button>
              <button data-mode="freelance" id="btn-freelance">
                Freelance · ፊሪላንስ
              </button>
            </div>
            <h1 className="hero-h" id="hero-h">
              Find Your Next <span className="accent">Opportunity</span> Faster.
            </h1>
            <p className="hero-sub-am am" id="hero-sub-am">
              በሺዎች የሚቆጠሩ የተረጋገጡ የስራ እድሎችን በኢትዮጵያ ውስጥ ያግኙ።
            </p>
            <p className="hero-sub-en" id="hero-sub-en">
              Discover thousands of verified job opportunities across Ethiopia. Search, apply, and
              get hired faster with the Beleqet Vacancy Platform.
            </p>

            <div className="search-bar">
              <div className="search-field">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  id="search-q"
                  placeholder="Job title, keyword or company"
                  aria-label="Search jobs"
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
                  placeholder="Location e.g. Addis Ababa"
                  aria-label="Location"
                />
              </div>
              <button id="search-btn" type="button">
                Search Jobs{' '}
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>

            <div className="popular" id="popular-wrap">
              <span>Popular Searches:</span>
              {['Developer', 'Marketing', 'Designer', 'Accounting', 'Sales', 'Remote'].map((t) => (
                <span key={t} className="tag-chip">
                  {t}
                </span>
              ))}
            </div>

            <div className="trust-chips" id="trust-chips">
              <div className="trust-chip">
                <span className="ic">
                  <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5z" />
                  </svg>
                </span>
                <div>
                  <b id="tc1-b">Verified &amp; Trusted</b>
                  <span id="tc1-s">100% verified job listings</span>
                </div>
              </div>
              <div className="trust-chip">
                <span className="ic">
                  <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h7l-1 8 11-14h-7l1-6z" />
                  </svg>
                </span>
                <div>
                  <b id="tc2-b">Real-time Alerts</b>
                  <span id="tc2-s">Get instant job updates</span>
                </div>
              </div>
              <div className="trust-chip">
                <span className="ic">
                  <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" />
                    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </span>
                <div>
                  <b id="tc3-b">Telegram Notifications</b>
                  <span id="tc3-s">Never miss an opportunity</span>
                </div>
              </div>
            </div>
          </div>

          <div className="board-wrap">
            <div className="float-badge" id="float-badge">
              <div className="fb-top">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h7l-1 8 11-14h-7l1-6z" />
                </svg>
                <span id="fb-title">New Job Alert</span>
              </div>
              <div className="fb-bottom" id="fb-sub">
                UI/UX Designer · Addis Ababa
              </div>
            </div>
            <div className="board">
              <div className="board-head">
                <span className="eb">Recommended for you</span>
                <div className="row1">
                  <h4 id="board-title">Fresh opportunities</h4>
                  <span className="new-badge" id="board-new-badge">
                    {stats.activeJobs ? `${stats.activeJobs.toLocaleString()} new` : '24 new'}
                  </span>
                </div>
              </div>
              <div className="board-rows" id="board-rows"></div>
              <a
                href={`${APP_URL}/jobs`}
                className="board-foot"
                id="board-foot-text"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                Explore all openings →
              </a>
            </div>
            <div className="float-stat" id="float-stat">
              <div className="fs-top">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 17l6-6 4 4 8-8" />
                  <path d="M15 7h6v6" />
                </svg>
                <span id="float-stat-value">3.2×</span>
              </div>
              <div className="fs-bottom" id="float-stat-label">
                more profile views
              </div>
            </div>
          </div>
        </section>

        <div className="stat-strip">
          <div className="stats reveal" id="stats-row">
            <div className="stat">
              <div className="ic">
                <svg viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="7" width="18" height="13" rx="1.5" />
                  <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <div>
                <b data-stat-key="activeJobs" data-suffix="+">
                  {(stats.activeJobs || 0).toLocaleString()}+
                </b>
                <span>Active Jobs</span>
              </div>
            </div>
            <div className="stat">
              <div className="ic">
                <svg viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M4 4h16v5H4z" />
                  <path d="M4 12h10v8H4z" />
                </svg>
              </div>
              <div>
                <b data-stat-key="hiringCompanies" data-suffix="+">
                  {(stats.hiringCompanies || 0).toLocaleString()}+
                </b>
                <span>Hiring Companies</span>
              </div>
            </div>
            <div className="stat">
              <div className="ic">
                <svg viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <b data-stat-key="registeredJobSeekers" data-suffix="+">
                  {(stats.registeredJobSeekers || 0).toLocaleString()}+
                </b>
                <span>Registered Job Seekers</span>
              </div>
            </div>
            <div className="stat">
              <div className="ic">
                <svg viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div>
                <b data-stat-key="satisfactionRate" data-suffix="%">
                  {stats.satisfactionRate || 98}%
                </b>
                <span>Satisfaction Rate</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section id="categories">
        <div className="sec-head reveal">
          <div>
            <div className="sec-eyebrow">Browse by Category</div>
            <h2 className="sec-h">Browse Jobs by Category</h2>
            <p className="sec-p">
              Explore opportunities across growing industries and find jobs that match your skills.
            </p>
          </div>
          <a className="view-all" href={`${APP_URL}/jobs`}>
            View all categories{' '}
            <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
        <div className="cat-row reveal">
          {[
            { label: 'IT & Software', slug: 'it-software', count: 0 },
            { label: 'Marketing', slug: 'marketing', count: 0 },
            { label: 'Finance', slug: 'finance', count: 0 },
            { label: 'Health', slug: 'health', count: 0 },
            { label: 'Education', slug: 'education', count: 0 },
            { label: 'Engineering', slug: 'engineering', count: 0 },
            { label: 'Other', slug: 'other', count: 0 },
          ].map((cat) => (
            <a
              key={cat.slug}
              href={`${APP_URL}/jobs?category=${cat.slug}`}
              className="cat-mini"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="icon">
                <svg viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="4" width="18" height="12" rx="1.5" />
                  <path d="M2 20h20" />
                </svg>
              </div>
              <b>{cat.label}</b>
              <span>Browse jobs</span>
            </a>
          ))}
        </div>

        <div className="subrow-label reveal">Browse Freelance Categories</div>
        <div className="cat-row reveal" id="freelance-categories">
          {[
            { label: 'Graphic Design', slug: 'graphic-design' },
            { label: 'Writing & Translation', slug: 'writing-translation' },
            { label: 'Web & App Dev', slug: 'web-app-dev' },
            { label: 'Video & Animation', slug: 'video-animation' },
            { label: 'Digital Marketing', slug: 'digital-marketing' },
            { label: 'Bookkeeping', slug: 'bookkeeping' },
          ].map((cat) => (
            <a
              key={cat.slug}
              href={`${APP_URL}/freelance?category=${cat.slug}`}
              className="cat-mini"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="icon">
                <svg viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M3 11l18-7-7 18-2-8-8-2z" />
                </svg>
              </div>
              <b>{cat.label}</b>
              <span>Browse gigs</span>
            </a>
          ))}
        </div>
      </section>

      <section id="featured" style={{ paddingTop: 0 }}>
        <div className="sec-head reveal">
          <div>
            <div className="sec-eyebrow">Curated for you</div>
            <h2 className="sec-h">Featured Jobs</h2>
            <p className="sec-p">Fresh opportunities from companies hiring right now.</p>
          </div>
          <a className="view-all" href={`${APP_URL}/jobs`}>
            View all jobs{' '}
            <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
        <div className="job-row reveal" id="featured-jobs"></div>
        <div className="subrow-label reveal">Featured Gigs</div>
        <div className="job-row reveal" id="featured-gigs"></div>
      </section>

      <div className="why-shell">
        <section id="why-choose">
          <div className="sec-head reveal" style={{ marginBottom: '32px' }}>
            <div>
              <div className="sec-eyebrow">The essentials</div>
              <h2 className="sec-h">Why Choose Beleqet?</h2>
            </div>
          </div>
          <div className="choose-row reveal">
            <div className="choose-card">
              <div className="icon">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5z" />
                </svg>
              </div>
              <b>Trusted Platform</b>
              <span>All jobs are verified for your security.</span>
            </div>
            <div className="choose-card">
              <div className="icon">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h7l-1 8 11-14h-7l1-6z" />
                </svg>
              </div>
              <b>Fast &amp; Easy</b>
              <span>Search and apply in just a few clicks.</span>
            </div>
            <div className="choose-card">
              <div className="icon">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.5 9a9 9 0 0 1 14.7-3.4L23 10M1 14l4.8 4.4A9 9 0 0 0 20.5 15" />
                </svg>
              </div>
              <b>Real-time Updates</b>
              <span>Get instant job alerts every step.</span>
            </div>
            <div className="choose-card">
              <div className="icon">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </div>
              <b>Telegram Alerts</b>
              <span>Get instant job alerts on Telegram.</span>
            </div>
            <div className="choose-card promo">
              <div className="icon">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="2" width="12" height="20" rx="2" />
                  <path d="M11 18h2" />
                </svg>
              </div>
              <b>Search on the go!</b>
              <span>Access thousands of jobs anytime, anywhere.</span>
              <div className="store-btns">
                <div className="store-btn">
                  <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3l18 9-18 9V3z" />
                  </svg>{' '}
                  Google Play
                </div>
                <div className="store-btn">
                  <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a5 5 0 0 0-5 5c0 3 3 4 3 8a4 4 0 0 0 4 4 4 4 0 0 0 4-4c0-4 3-5 3-8a5 5 0 0 0-5-5" />
                  </svg>{' '}
                  App Store
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="trusted">
        <div className="sec-head reveal" style={{ marginBottom: '26px' }}>
          <div>
            <div className="sec-eyebrow">Trusted by</div>
            <h2 className="sec-h" style={{ fontSize: 'clamp(20px,2vw,24px)' }}>
              Companies hiring — for roles and projects.
            </h2>
          </div>
        </div>
        <div className="marquee-outer reveal">
          <div className="marquee-track" id="logo-track"></div>
        </div>
      </section>

      <section id="why">
        <div className="sec-head reveal" style={{ display: 'block' }}>
          <div className="sec-eyebrow">The details</div>
          <h2 className="sec-h">Every feature, built with a reason.</h2>
          <p className="sec-p">
            Not a translated template — one account, one trust system, for jobs and freelance work
            alike.
          </p>
        </div>
        <div className="why-group">
          <div className="why-label reveal">For job seekers</div>
          <div className="diffs">
            {[
              ['01', 'Salary transparency', 'See the real number before you apply.'],
              ['02', 'Direct application links', 'Every listing routes straight to the employer.'],
              ['03', 'AI-powered matching', 'The matcher learns from real outcomes.'],
              ['04', 'Amharic-first, always', 'Designed in Amharic from day one.'],
            ].map(([n, h, p]) => (
              <div key={n} className="diff reveal">
                <span className="num">{n}</span>
                <div>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="why-group">
          <div className="why-label reveal">For freelancers &amp; clients</div>
          <div className="diffs">
            {[
              [
                '01',
                'Escrow-protected payments',
                'Funds sit safely in BeleqetSafe until you approve.',
              ],
              ['02', 'Local payment rails', 'Get paid through Chapa or Telebirr.'],
              [
                '03',
                'Verified freelancer profiles',
                'Portfolios and ratings tied to real delivered work.',
              ],
              ['04', 'No agency cut', "Beleqet's fee is disclosed upfront."],
            ].map(([n, h, p]) => (
              <div key={n} className="diff reveal">
                <span className="num">{n}</span>
                <div>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials">
        <div className="sec-head reveal" style={{ display: 'block' }}>
          <div className="sec-eyebrow">Testimonials</div>
          <h2 className="sec-h">People who stopped scrolling and got hired — or got paid.</h2>
          <p className="sec-p">Real roles and real projects, in their own words.</p>
        </div>
        <div className="marquee-outer reveal">
          <div className="marquee-track reverse" id="testi-track"></div>
        </div>
      </section>

      <div className="cta-shell">
        <section id="community" style={{ padding: 0 }}>
          <div className="cta-band reveal">
            <div>
              <div className="cta-icon">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
              </div>
              <h3>Never Miss an Opportunity</h3>
              <p>
                Join the Beleqet Telegram channel and get instant job and gig alerts delivered
                directly to your phone.
              </p>
            </div>
            <div className="cta-buttons">
              <a
                className="btn btn-lime"
                href="https://t.me/BeleqetJobs"
                target="_blank"
                rel="noreferrer"
              >
                Join Telegram Channel{' '}
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <a className="btn btn-outline-hero" href={`${APP_URL}/jobs`}>
                Browse Jobs &amp; Gigs
              </a>
            </div>
          </div>
        </section>
      </div>

      <footer>
        <div className="foot-inner">
          <div className="foot-top">
            <div className="foot-brand">
              <div className="wordmark-row">
                <span className="logo-dot">
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 11l18-7-7 18-2-8-8-2z" />
                  </svg>
                </span>
                <div className="wordmark">
                  <b>Beleqet Job</b>
                </div>
              </div>
              <p>
                Beleqet helps job seekers and freelancers discover opportunities across Ethiopia.
              </p>
            </div>
            <div className="foot-cols">
              <div className="foot-col">
                <h4>For Job Seekers</h4>
                <a href={`${APP_URL}/jobs`}>Find Jobs</a>
                <a href={`${APP_URL}/jobs`}>Browse Categories</a>
                <a href={`${APP_URL}/cv-maker`}>CV Maker</a>
                <a href="https://t.me/BeleqetJobs" target="_blank" rel="noreferrer">
                  Telegram Alerts
                </a>
              </div>
              <div className="foot-col">
                <h4>For Freelancers</h4>
                <a href={`${APP_URL}/freelance`}>Browse Gigs</a>
                <a href={`${APP_URL}/post-project`}>Post a Project</a>
                <a href={`${APP_URL}/escrow`}>BeleqetSafe Escrow</a>
                <a href={`${APP_URL}/freelance/register`}>Become a Freelancer</a>
              </div>
              <div className="foot-col">
                <h4>For Employers</h4>
                <a href={`${APP_URL}/post-job`}>Post a Job</a>
                <a href={`${APP_URL}/candidates`}>Find Candidates</a>
                <a href={`${APP_URL}/pricing`}>Pricing</a>
                <a href={`${APP_URL}/support`}>Support</a>
              </div>
              <div className="foot-col">
                <h4>Contact</h4>
                <a href="#">Addis Ababa, Ethiopia</a>
                <a href="https://beleqetjobs.com">beleqetjobs.com</a>
                <a href="https://t.me/BeleqetJobs" target="_blank" rel="noreferrer">
                  Telegram Channel
                </a>
                <a href={`${APP_URL}/support`}>Support Center</a>
              </div>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 Beleqet Vacancy Platform. All rights reserved.</span>
            <span>Addis Ababa · Built for Ethiopian talent.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
