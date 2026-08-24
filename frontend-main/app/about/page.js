export const metadata = {
  title: 'About Beleqet | Ethiopian Talent Marketplace',
  description:
    'Beleqet connects Ethiopian professionals with credible employers. Our purpose: shorten the distance between talent and opportunity.',
};

const STATS = [
  { icon: '💼', value: '10K+', label: 'Active Jobs' },
  { icon: '🏢', value: '5K+', label: 'Hiring Companies' },
  { icon: '👥', value: '50K+', label: 'Registered Seekers' },
  { icon: '🔗', value: 'One', label: 'Unified Platform' },
];

const VALUES = [
  {
    title: 'Trust before traffic',
    body: 'A useful marketplace starts with credible content. Every job listing, employer profile, and freelancer review is verified before going live.',
  },
  {
    title: 'Built for local reality',
    body: "Beleqet is designed around Ethiopia's labour market, payment infrastructure (Chapa, Telebirr), and language needs — Amharic first, not an afterthought.",
  },
  {
    title: 'Opportunity with dignity',
    body: 'Candidates deserve clarity. Salary, contract type, and employer details are shown upfront. No hidden conditions, no pay-to-apply gates.',
  },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      {/* ── Hero ── */}
      <section className="ab-hero">
        <div className="ab-hero__inner">
          <p className="ab-eyebrow">OUR PURPOSE</p>
          <h1 className="ab-hero__h">
            Ethiopian talent
            <br />
            deserves better
            <br />
            access.
          </h1>
          <p className="ab-hero__sub">
            Beleqet connects people with credible employers through one focused career marketplace —
            making discovery, application, and hiring simpler for everyone.
          </p>
        </div>
      </section>

      {/* ── Why we exist ── */}
      <section className="ab-why">
        <div className="ab-why__inner">
          <div className="ab-why__left">
            <p className="ab-eyebrow ab-eyebrow--dark">WHY WE EXIST</p>
            <h2 className="ab-why__h">
              The distance between talent and opportunity should be shorter.
            </h2>
          </div>
          <div className="ab-why__right">
            <p className="ab-body">
              Too many skilled professionals spend weeks searching across scattered platforms,
              sending CVs into silence, and waiting months for outcomes. Employers face the same
              friction on the other side of the same problem.
            </p>
            <p className="ab-body" style={{ marginTop: 16 }}>
              Beleqet brings job discovery, CV tools, applications, employer profiling, and direct
              talent search into a single platform — built first for the Ethiopian context, and
              scaling outward from there.
            </p>
          </div>
        </div>

        {/* Stats inline */}
        <div className="ab-stats">
          {STATS.map(({ icon, value, label }) => (
            <div key={label} className="ab-stat">
              <span className="ab-stat__icon" aria-hidden="true">
                {icon}
              </span>
              <b className="ab-stat__value">{value}</b>
              <span className="ab-stat__label">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── What makes us ── */}
      <section className="ab-values">
        <div className="ab-values__inner">
          <p className="ab-eyebrow ab-eyebrow--dark">WHAT MAKES US</p>
          <h2 className="ab-values__h">A marketplace people can rely on.</h2>
          <div className="ab-cards">
            {VALUES.map(({ title, body }) => (
              <div key={title} className="ab-card">
                <span className="ab-card__dot" aria-hidden="true" />
                <h3 className="ab-card__title">{title}</h3>
                <p className="ab-card__body">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <div className="ab-cta">
        <div className="ab-cta__inner">
          <div className="ab-cta__copy">
            <h2 className="ab-cta__h">Make your next move.</h2>
            <p className="ab-cta__sub">
              Whether you&apos;re searching for a role or building a team — Beleqet is where it
              starts.
            </p>
          </div>
          <div className="ab-cta__btns">
            <a className="ab-btn ab-btn--dark" href="/jobs">
              Find Jobs
            </a>
            <a className="ab-btn ab-btn--outline" href="/post-job">
              Hire Talent
            </a>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="ab-footer">
        <div className="ab-footer__inner">
          <div className="ab-footer__brand">
            <div className="ab-footer__logo">
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l18-7-7 18-2-8-8-2z" />
              </svg>
            </div>
            <p className="ab-footer__tagline">
              Beleqet helps job seekers and employers connect with the right talent across Ethiopia.
            </p>
          </div>
          <div className="ab-footer__col">
            <h4>FOR JOB SEEKERS</h4>
            <a href="/jobs">Find Jobs</a>
            <a href="/jobs?type=REMOTE">Browse Companies</a>
            <a href="/cv-maker">CV Maker</a>
            <a href="/portfolio">Portfolio Builder</a>
            <a href="/pricing">Telegram Alerts</a>
          </div>
          <div className="ab-footer__col">
            <h4>FOR EMPLOYERS</h4>
            <a href="/post-job">Post a Job</a>
            <a href="/for-employers">Find Candidates</a>
            <a href="/pricing">Pricing</a>
            <a href="/contact">Support</a>
          </div>
          <div className="ab-footer__col">
            <h4>COMPANY</h4>
            <a href="/about">About Beleqet</a>
            <a href="/contact">Contact Us</a>
            <a href="/pricing">Telegram Channel</a>
            <a href="/contact">Support Center</a>
          </div>
        </div>
        <div className="ab-footer__bottom">
          <span>© 2026 Beleqet Ecosystem Platform. All rights reserved.</span>
          <div className="ab-footer__legal">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
