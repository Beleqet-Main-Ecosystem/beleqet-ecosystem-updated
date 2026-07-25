"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    function initials(name) {
      return name.split(" ").map((w) => w[0]).slice(0, 2).join("");
    }
    const chipColors = ["#123626", "#1B4A33", "#123626", "#0E2C1E", "#123626"];
    function chipColor(i) {
      return chipColors[i % chipColors.length];
    }

    const navEl = document.getElementById("site-nav");
    const onScroll = () => navEl.classList.toggle("scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll);

    /* ---------- hero board datasets ---------- */
    const jobs = [
      { role: "Senior Product Designer", co: "Kifiya Financial Technology", pay: "12,000–18,000", unit: "ETB" },
      { role: "Frontend Engineer", co: "PRAGMA Investment", pay: "25,000–35,000", unit: "ETB" },
      { role: "Marketing Lead", co: "Dinsi Manufacturing", pay: "14,000–20,000", unit: "ETB" },
      { role: "Full Stack Developer", co: "TakaCash", pay: "20,000–28,000", unit: "ETB" },
      { role: "HR & Admin Officer", co: "Safaricom Ethiopia", pay: "11,000–16,000", unit: "ETB" },
    ];
    const gigs = [
      { role: "Logo Design for Coffee Brand", co: "Boutique Roastery", pay: "3,500–6,000", unit: "ETB" },
      { role: "WordPress Bug Fixes", co: "Retail Startup", pay: "250–400", unit: "ETB/hr" },
      { role: "Amharic–English Translation", co: "NGO Project", pay: "2,000–3,500", unit: "ETB" },
      { role: "Social Media Content Calendar", co: "FMCG Brand", pay: "4,000–7,000", unit: "ETB" },
      { role: "Monthly Bookkeeping", co: "Small Retailer", pay: "3,000", unit: "ETB/mo" },
    ];
    function rowHtml(item, i) {
      return `<div class="flip-inner">
        <span class="chip" style="background:${chipColor(i)};">${initials(item.role)}</span>
        <div class="role"><b>${item.role}</b><span>${item.co}</span></div>
        <div class="pay"><b>${item.pay}</b><span>${item.unit}</span></div>
      </div>`;
    }
    const boardEl = document.getElementById("board-rows");
    const ROWS = 3;
    const state = { pool: jobs.slice(), visible: jobs.slice(0, ROWS) };
    function renderBoard() {
      boardEl.innerHTML = state.visible
        .map((item, i) => `<div class="row" data-i="${i}">${rowHtml(item, i)}</div>`)
        .join("");
    }
    function staggerFlipIn() {
      document.querySelectorAll("#board-rows .row").forEach((r, i) => {
        setTimeout(() => {
          r.classList.add("flipping");
          setTimeout(() => r.classList.remove("flipping"), 650);
        }, i * 150);
      });
    }
    function setBoardMode(mode) {
      state.pool = mode === "jobs" ? jobs.slice() : gigs.slice();
      state.visible = state.pool.slice(0, ROWS);
      renderBoard();
      staggerFlipIn();
    }
    setBoardMode("jobs");

    const boardInterval = setInterval(() => {
      if (!state.visible.length) return;
      const idx = Math.floor(Math.random() * state.visible.length);
      const rowEl = document.querySelector(`#board-rows .row[data-i="${idx}"]`);
      if (!rowEl) return;
      rowEl.classList.add("flipping");
      setTimeout(() => {
        const next = state.pool[Math.floor(Math.random() * state.pool.length)];
        state.visible[idx] = next;
        const match = rowHtml(next, idx).match(/<div class="flip-inner">([\s\S]*)<\/div>/);
        rowEl.querySelector(".flip-inner").innerHTML = match[1];
      }, 300);
      setTimeout(() => rowEl.classList.remove("flipping"), 650);
    }, 3400);

    /* ---------- featured jobs / gigs grids ---------- */
    const featuredJobs = [
      { role: "Full Stack Developer", co: "TakaCash", loc: "Addis Ababa", type: "fulltime", typeLabel: "Full Time", time: "2h ago" },
      { role: "Digital Marketing Specialist", co: "ethio telecom", loc: "Addis Ababa", type: "hybrid", typeLabel: "Hybrid", time: "4h ago" },
      { role: "Customer Service Agent", co: "Dashen Bank", loc: "Addis Ababa", type: "onsite", typeLabel: "On-site", time: "6h ago" },
      { role: "Graphic Designer", co: "System One", loc: "Remote", type: "remote", typeLabel: "Remote", time: "8h ago" },
      { role: "HR & Admin Officer", co: "Safaricom Ethiopia", loc: "Addis Ababa", type: "fulltime", typeLabel: "Full Time", time: "12h ago" },
    ];
    const featuredGigs = [
      { role: "Logo & Brand Kit", co: "Boutique Roastery", loc: "Fixed price", type: "fixed", typeLabel: "Fixed", time: "1h ago" },
      { role: "WordPress Bug Fixes", co: "Retail Startup", loc: "Hourly", type: "hourly", typeLabel: "Hourly", time: "3h ago" },
      { role: "Translation, 20 Pages", co: "NGO Project", loc: "Fixed price", type: "fixed", typeLabel: "Fixed", time: "5h ago" },
      { role: "Explainer Video Edit", co: "EdTech Startup", loc: "Fixed price", type: "fixed", typeLabel: "Fixed", time: "9h ago" },
      { role: "Monthly Bookkeeping", co: "Small Retailer", loc: "Retainer", type: "hourly", typeLabel: "Retainer", time: "1d ago" },
    ];
    function jobCard(item, i) {
      return `<div class="job-card">
        <div class="jc-top">
          <span class="jc-chip" style="background:${chipColor(i)};">${initials(item.role)}</span>
          <button class="bookmark" onclick="this.classList.toggle('saved')"><svg viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg></button>
        </div>
        <h4>${item.role}</h4>
        <p class="co">${item.co}</p>
        <p class="loc"><svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>${item.loc}</p>
        <div class="jc-bottom"><span class="type-tag ${item.type}">${item.typeLabel}</span><span class="posted">${item.time}</span></div>
      </div>`;
    }
    document.getElementById("featured-jobs").innerHTML = featuredJobs.map(jobCard).join("");
    document.getElementById("featured-gigs").innerHTML = featuredGigs.map(jobCard).join("");

    /* ---------- hero mode toggle ---------- */
    const modeContent = {
      jobs: {
        h1: 'Find Your Next <span class="accent">Opportunity</span> Faster.',
        subAm: "በሺዎች የሚቆጠሩ የተረጋገጡ የስራ እድሎችን በኢትዮጵያ ውስጥ ያግኙ።",
        subEn:
          "Discover thousands of verified job opportunities across Ethiopia. Search, apply, and get hired faster with the Beleqet Vacancy Platform.",
        qPlaceholder: "Job title, keyword or company",
        locPlaceholder: "Location e.g. Addis Ababa",
        btnText: "Search Jobs",
        popular: ["Developer", "Marketing", "Designer", "Accounting", "Sales", "Remote"],
        trust: [
          ["Verified &amp; Trusted", "100% verified job listings"],
          ["Real-time Alerts", "Get instant job updates"],
          ["Telegram Notifications", "Never miss an opportunity"],
        ],
        boardTitle: "Fresh opportunities",
        boardBadge: "24 new",
        boardFoot: "Explore all openings →",
        fbTitle: "New Job Alert",
        fbSub: "UI/UX Designer · Addis Ababa",
        floatStatValue: "3.2×",
        floatStatLabel: "more profile views",
        navCta: "Post a Job",
      },
      freelance: {
        h1: 'Get Your Next <span class="accent">Project</span> Paid Safely.',
        subAm: "ክፍያ በ Escrow የተጠበቀ፣ ደንበኛ ወይም ፊሪላንሰርን በቀጥታ ያግኙ።",
        subEn:
          "Post projects to verified Ethiopian clients, get paid safely through escrow, and grow your freelance career with confidence.",
        qPlaceholder: "What do you need done",
        locPlaceholder: "Budget range",
        btnText: "Find Talent",
        popular: ["Design", "Writing", "Web Dev", "Video", "Marketing", "Bookkeeping"],
        trust: [
          ["Escrow Protected", "Funds held until you approve"],
          ["Verified Freelancers", "Portfolios &amp; real ratings"],
          ["Chapa &amp; Telebirr", "Local payouts, no delay"],
        ],
        boardTitle: "Fresh gigs",
        boardBadge: "18 new",
        boardFoot: "Explore all live gigs →",
        fbTitle: "New Gig Alert",
        fbSub: "Logo Design · Remote",
        floatStatValue: "98%",
        floatStatLabel: "on-time payouts",
        navCta: "Post a Project",
      },
    };

    function moveIndicator(btn) {
      const ind = document.getElementById("mode-indicator");
      ind.style.width = btn.offsetWidth + "px";
      ind.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
    }

    function applyMode(mode) {
      const c = modeContent[mode];
      const wrap = document.getElementById("hero-copy");
      wrap.classList.add("is-switching");
      setTimeout(() => {
        document.getElementById("hero-h").innerHTML = c.h1;
        document.getElementById("hero-sub-am").textContent = c.subAm;
        document.getElementById("hero-sub-en").textContent = c.subEn;
        document.getElementById("search-q").placeholder = c.qPlaceholder;
        document.getElementById("search-loc").placeholder = c.locPlaceholder;
        document.getElementById("search-btn").childNodes[0].textContent = c.btnText + " ";
        document.getElementById("popular-wrap").innerHTML =
          "<span>Popular Searches:</span>" +
          c.popular.map((t) => `<span class="tag-chip">${t}</span>`).join("");
        document.getElementById("tc1-b").innerHTML = c.trust[0][0];
        document.getElementById("tc1-s").innerHTML = c.trust[0][1];
        document.getElementById("tc2-b").innerHTML = c.trust[1][0];
        document.getElementById("tc2-s").innerHTML = c.trust[1][1];
        document.getElementById("tc3-b").innerHTML = c.trust[2][0];
        document.getElementById("tc3-s").innerHTML = c.trust[2][1];
        wrap.classList.remove("is-switching");
      }, 260);

      document.getElementById("board-title").textContent = c.boardTitle;
      document.getElementById("board-new-badge").textContent = c.boardBadge;
      document.getElementById("board-foot-text").textContent = c.boardFoot;
      document.getElementById("fb-title").textContent = c.fbTitle;
      document.getElementById("fb-sub").textContent = c.fbSub;
      document.getElementById("float-stat-value").textContent = c.floatStatValue;
      document.getElementById("float-stat-label").textContent = c.floatStatLabel;
      document.getElementById("nav-cta").textContent = c.navCta;

      document.querySelectorAll(".mode-toggle button").forEach((b) =>
        b.classList.toggle("active", b.dataset.mode === mode)
      );
      moveIndicator(document.getElementById(mode === "jobs" ? "btn-jobs" : "btn-freelance"));
      setBoardMode(mode);
    }
    const toggleButtons = Array.from(document.querySelectorAll(".mode-toggle button"));
    const toggleHandlers = toggleButtons.map((b) => {
      const handler = () => applyMode(b.dataset.mode);
      b.addEventListener("click", handler);
      return { b, handler };
    });
    moveIndicator(document.getElementById("btn-jobs"));

    /* ---------- stat count-up ---------- */
    function animateCount(el) {
      const target = parseInt(el.dataset.target, 10);
      const suffix = el.dataset.suffix || "";
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
            document.querySelectorAll("#stats-row b[data-target]").forEach(animateCount);
            statIo.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    statIo.observe(document.getElementById("stats-row"));

    /* ---------- trusted companies marquee ---------- */
    const companies = [
      "Super SGS Trading", "Habesha Retail Group", "Merkato Foods", "Addis Logistics Co.",
      "Sheba Telecom", "Blue Nile Finance", "Kaffa Media House", "Entoto Manufacturing",
      "Rift Valley Agro", "Awash Bank Group",
    ];
    function logoBadge(name) {
      return `<div class="logo-badge"><span class="mono">${initials(name)}</span><b>${name}</b></div>`;
    }
    const logoTrack = document.getElementById("logo-track");
    const logoHtml = companies.map(logoBadge).join("");
    logoTrack.innerHTML = logoHtml + logoHtml;

    /* ---------- testimonials marquee ---------- */
    const testimonials = [
      { q: "I found a marketing job with the salary listed upfront — no back and forth. Applied directly and started two weeks later.", n: "Selamawit T.", r: "Digital Marketing Officer, Addis Ababa", tag: "job" },
      { q: "My payment sat safely in escrow until I delivered the logo — released to Telebirr the same evening.", n: "Selam H.", r: "Freelance Graphic Designer", tag: "freelance" },
      { q: "Every other site buried the pay range. Beleqet showed it right on the card — that's the whole reason I trust it.", n: "Yonas B.", r: "Accountant, Addis Ababa", tag: "job" },
      { q: "We hired a freelance developer for a two-week fix. Escrow meant we could pay upfront without worrying.", n: "Abel N.", r: "Founder, hiring on Beleqet Freelance", tag: "freelance" },
      { q: "The Telegram alert caught a listing an hour after it posted. I was the third applicant by lunchtime.", n: "Bethelhem A.", r: "Customer Service Rep, Adama", tag: "job" },
      { q: "Amharic first, not an afterthought. It's the first platform that actually reads like it was built for us.", n: "Dawit K.", r: "Frontend Developer, Remote", tag: "job" },
      { q: "We posted one role and had six qualified direct applications by evening — no recruiter fees, no back-and-forth.", n: "Hiwot M.", r: "HR Lead, hiring on Beleqet", tag: "job" },
      { q: "Direct apply meant I skipped the agency entirely. Interview was booked the same week.", n: "Mikiyas G.", r: "Sales Executive, Addis Ababa", tag: "job" },
    ];
    function testiCard(t) {
      const label = t.tag === "job" ? "JOB" : "FREELANCE";
      return `<div class="t-card"><span class="t-tag ${t.tag}">${label}</span><span class="qmark">&ldquo;</span><p class="quote">${t.q}</p><div class="who"><div class="avatar">${initials(t.n)}</div><div><b>${t.n}</b><span>${t.r}</span></div></div></div>`;
    }
    const testiTrack = document.getElementById("testi-track");
    const testiHtml = testimonials.map(testiCard).join("");
    testiTrack.innerHTML = testiHtml + testiHtml;

    /* ---------- scroll reveal ---------- */
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      clearInterval(boardInterval);
      toggleHandlers.forEach(({ b, handler }) => b.removeEventListener("click", handler));
      statIo.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <>
      <header className="nav" id="site-nav">
        <div className="wordmark-row">
          <span className="logo-dot">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l18-7-7 18-2-8-8-2z" />
            </svg>
          </span>
          <div className="wordmark">
            <b>Beleqet Job</b>
          </div>
          <span className="pill-new">+ Freelance</span>
        </div>
        <nav className="links">
          <a href="#categories">Find Jobs</a>
          <a href="#freelance-categories">Freelance</a>
          <a href="#">CV Maker</a>
          <a href="#">Pricing</a>
          <a href="#">Contact</a>
        </nav>
        <div style={{ display: "flex", gap: "10px" }}>
          <a className="btn btn-ghost" href="#">Login</a>
          <a className="btn btn-dark" href="#" id="nav-cta">Post a Job</a>
        </div>
      </header>

      <div className="hero-shell">
        <section className="hero" style={{ paddingTop: "44px" }}>
          <div id="hero-copy">
            <div className="mode-toggle" id="mode-toggle">
              <span className="indicator" id="mode-indicator"></span>
              <button className="active" data-mode="jobs" id="btn-jobs">Jobs · ስራ</button>
              <button data-mode="freelance" id="btn-freelance">Freelance · ፊሪላንስ</button>
            </div>

            <h1 className="hero-h" id="hero-h">
              Find Your Next <span className="accent">Opportunity</span> Faster.
            </h1>
            <p className="hero-sub-am am" id="hero-sub-am">
              በሺዎች የሚቆጠሩ የተረጋገጡ የስራ እድሎችን በኢትዮጵያ ውስጥ ያግኙ።
            </p>
            <p className="hero-sub-en" id="hero-sub-en">
              Discover thousands of verified job opportunities across Ethiopia. Search, apply, and get hired faster with the Beleqet Vacancy Platform.
            </p>

            <div className="search-bar">
              <div className="search-field">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input type="text" id="search-q" placeholder="Job title, keyword or company" />
              </div>
              <div className="search-divider"></div>
              <div className="search-field" style={{ flex: 0.75 }}>
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <input type="text" id="search-loc" placeholder="Location e.g. Addis Ababa" />
              </div>
              <button id="search-btn">
                Search Jobs{" "}
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>

            <div className="popular" id="popular-wrap">
              <span>Popular Searches:</span>
              <span className="tag-chip">Developer</span>
              <span className="tag-chip">Marketing</span>
              <span className="tag-chip">Designer</span>
              <span className="tag-chip">Accounting</span>
              <span className="tag-chip">Sales</span>
              <span className="tag-chip">Remote</span>
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
              <div className="fb-bottom" id="fb-sub">UI/UX Designer · Addis Ababa</div>
            </div>
            <div className="board">
              <div className="board-head">
                <span className="eb">Recommended for you</span>
                <div className="row1">
                  <h4 id="board-title">Fresh opportunities</h4>
                  <span className="new-badge" id="board-new-badge">24 new</span>
                </div>
              </div>
              <div className="board-rows" id="board-rows"></div>
              <div className="board-foot" id="board-foot-text">Explore all openings →</div>
            </div>
            <div className="float-stat" id="float-stat">
              <div className="fs-top">
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 17l6-6 4 4 8-8" />
                  <path d="M15 7h6v6" />
                </svg>
                <span id="float-stat-value">3.2×</span>
              </div>
              <div className="fs-bottom" id="float-stat-label">more profile views</div>
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
                <b data-target="10000" data-suffix="+">0</b>
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
                <b data-target="5000" data-suffix="+">0</b>
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
                <b data-target="50000" data-suffix="+">0</b>
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
                <b data-target="98" data-suffix="%">0</b>
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
            <p className="sec-p">Explore opportunities across growing industries and find jobs that match your skills.</p>
          </div>
          <a className="view-all" href="#">
            View all categories{" "}
            <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
        <div className="cat-row reveal">
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M2 20h20" /></svg></div><b>IT &amp; Software</b><span>1,250 jobs</span></div>
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><path d="M3 11l18-7-7 18-2-8-8-2z" /></svg></div><b>Marketing</b><span>642 jobs</span></div>
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></svg></div><b>Finance</b><span>423 jobs</span></div>
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5z" /></svg></div><b>Health</b><span>192 jobs</span></div>
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5" /></svg></div><b>Education</b><span>288 jobs</span></div>
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg></div><b>Engineering</b><span>404 jobs</span></div>
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /><circle cx="5" cy="12" r="1.6" /></svg></div><b>Other</b><span>1,135 jobs</span></div>
        </div>

        <div className="subrow-label reveal">Browse Freelance Categories</div>
        <div className="cat-row reveal" id="freelance-categories">
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z" /><circle cx="11" cy="11" r="2" /></svg></div><b>Graphic Design</b><span>210 gigs</span></div>
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 21h10a2 2 0 0 0 2-2V7l-4-4H7a2 2 0 0 0-2 2v3" /><path d="M2 15h5" /><path d="M2 18h5" /></svg></div><b>Writing &amp; Translation</b><span>184 gigs</span></div>
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><path d="M16 18l6-6-6-6" /><path d="M8 6l-6 6 6 6" /></svg></div><b>Web &amp; App Dev</b><span>256 gigs</span></div>
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><rect x="2" y="5" width="15" height="14" rx="1.5" /><path d="M17 9l5-3v12l-5-3" /></svg></div><b>Video &amp; Animation</b><span>97 gigs</span></div>
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><path d="M3 11l18-7-7 18-2-8-8-2z" /></svg></div><b>Digital Marketing</b><span>142 gigs</span></div>
          <div className="cat-mini"><div className="icon"><svg viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></svg></div><b>Bookkeeping</b><span>71 gigs</span></div>
        </div>
      </section>

      <section id="featured" style={{ paddingTop: 0 }}>
        <div className="sec-head reveal">
          <div>
            <div className="sec-eyebrow">Curated for you</div>
            <h2 className="sec-h">Featured Jobs</h2>
            <p className="sec-p">Fresh opportunities from companies hiring right now.</p>
          </div>
          <a className="view-all" href="#">
            View all jobs{" "}
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
        <section id="why-choose" style={{ padding: "88px clamp(20px,5vw,64px)" }}>
          <div className="sec-head reveal" style={{ marginBottom: "32px" }}>
            <div>
              <div className="sec-eyebrow">The essentials</div>
              <h2 className="sec-h">Why Choose Beleqet?</h2>
            </div>
          </div>
          <div className="choose-row reveal">
            <div className="choose-card">
              <div className="icon"><svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5z" /></svg></div>
              <b>Trusted Platform</b>
              <span>All jobs are verified for your security.</span>
            </div>
            <div className="choose-card">
              <div className="icon"><svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h7l-1 8 11-14h-7l1-6z" /></svg></div>
              <b>Fast &amp; Easy</b>
              <span>Search and apply in just a few clicks.</span>
            </div>
            <div className="choose-card">
              <div className="icon"><svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6" /><path d="M1 20v-6h6" /><path d="M3.5 9a9 9 0 0 1 14.7-3.4L23 10M1 14l4.8 4.4A9 9 0 0 0 20.5 15" /></svg></div>
              <b>Real-time Updates</b>
              <span>Get instant job alerts every step.</span>
            </div>
            <div className="choose-card">
              <div className="icon"><svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg></div>
              <b>Telegram Alerts</b>
              <span>Get instant job alerts on Telegram.</span>
            </div>
            <div className="choose-card promo">
              <div className="icon"><svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></svg></div>
              <b>Search on the go!</b>
              <span>Access thousands of jobs anytime, anywhere.</span>
              <div className="store-btns">
                <div className="store-btn"><svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 9-18 9V3z" /></svg> Google Play</div>
                <div className="store-btn"><svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 0-5 5c0 3 3 4 3 8a4 4 0 0 0 4 4 4 4 0 0 0 4-4c0-4 3-5 3-8a5 5 0 0 0-5-5" /></svg> App Store</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="trusted">
        <div className="sec-head reveal" style={{ marginBottom: "26px" }}>
          <div>
            <div className="sec-eyebrow">Trusted by</div>
            <h2 className="sec-h" style={{ fontSize: "clamp(20px,2vw,24px)" }}>Companies hiring — for roles and projects.</h2>
          </div>
        </div>
        <div className="marquee-outer reveal">
          <div className="marquee-track" id="logo-track"></div>
        </div>
      </section>

      <section id="why">
        <div className="sec-head reveal" style={{ display: "block" }}>
          <div className="sec-eyebrow">The details</div>
          <h2 className="sec-h">Every feature, built with a reason.</h2>
          <p className="sec-p">Not a translated template, and not two products stapled together — one account, one trust system, for jobs and freelance work alike.</p>
        </div>
        <div className="why-group">
          <div className="why-label reveal">For job seekers</div>
          <div className="diffs">
            <div className="diff reveal"><span className="num">01</span><div><h3>Salary transparency</h3><p>See the real number before you apply. No surprises, no negotiation guessing games at the interview stage.</p></div></div>
            <div className="diff reveal"><span className="num">02</span><div><h3>Direct application links</h3><p>Every listing routes straight to the employer's own channel — no recruiter middlemen, no forms that vanish.</p></div></div>
            <div className="diff reveal"><span className="num">03</span><div><h3>AI-powered matching</h3><p>The matcher learns from real outcomes, not just keyword overlap, so recommendations sharpen the more you use it.</p></div></div>
            <div className="diff reveal"><span className="num">04</span><div><h3>Amharic-first, always</h3><p>Designed in Amharic from day one, with English alongside it — not bolted on as an afterthought.</p></div></div>
          </div>
        </div>
        <div className="why-group">
          <div className="why-label reveal">For freelancers &amp; clients</div>
          <div className="diffs">
            <div className="diff reveal"><span className="num">01</span><div><h3>Escrow-protected payments</h3><p>Funds sit safely in BeleqetSafe until you approve the work, with a 14-day auto-approval so nothing stalls forever.</p></div></div>
            <div className="diff reveal"><span className="num">02</span><div><h3>Local payment rails</h3><p>Get paid the way you already do business — through Chapa or Telebirr, no international wallet required.</p></div></div>
            <div className="diff reveal"><span className="num">03</span><div><h3>Verified freelancer profiles</h3><p>Portfolios and ratings tied to real delivered work, not just a profile photo and a claim.</p></div></div>
            <div className="diff reveal"><span className="num">04</span><div><h3>No agency cut</h3><p>You deal directly with the client or freelancer — Beleqet's fee is disclosed upfront, nothing hidden later.</p></div></div>
          </div>
        </div>
      </section>

      <section id="testimonials">
        <div className="sec-head reveal" style={{ display: "block" }}>
          <div className="sec-eyebrow">Testimonials</div>
          <h2 className="sec-h">People who stopped scrolling and got hired — or got paid.</h2>
          <p className="sec-p">Real roles and real projects, job seekers, freelancers, and the people hiring them — in their own words.</p>
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
              <p>Join the Beleqet Telegram channel and get instant job and gig alerts delivered directly to your phone.</p>
            </div>
            <div className="cta-buttons">
              <a className="btn btn-lime" href="https://t.me/BeleqetJobs" target="_blank" rel="noreferrer">
                Join Telegram Channel{" "}
                <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <a className="btn btn-outline-hero" href="#categories">Browse Jobs &amp; Gigs</a>
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
                <div className="wordmark"><b>Beleqet Job</b></div>
              </div>
              <p>Beleqet helps job seekers and freelancers discover opportunities, and employers and clients connect with the right talent across Ethiopia.</p>
            </div>
            <div className="foot-cols">
              <div className="foot-col"><h4>For Job Seekers</h4><a href="#categories">Find Jobs</a><a href="#categories">Browse Categories</a><a href="#">CV Maker</a><a href="#">Telegram Alerts</a></div>
              <div className="foot-col"><h4>For Freelancers</h4><a href="#freelance-categories">Browse Gigs</a><a href="#">Post a Project</a><a href="#">BeleqetSafe Escrow</a><a href="#">Become a Freelancer</a></div>
              <div className="foot-col"><h4>For Employers</h4><a href="#">Post a Job</a><a href="#">Find Candidates</a><a href="#">Pricing</a><a href="#">Support</a></div>
              <div className="foot-col"><h4>Contact</h4><a href="#">Addis Ababa, Ethiopia</a><a href="#">beleqet.com</a><a href="https://t.me/BeleqetJobs" target="_blank" rel="noreferrer">Telegram Channel</a><a href="#">Support Center</a></div>
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
