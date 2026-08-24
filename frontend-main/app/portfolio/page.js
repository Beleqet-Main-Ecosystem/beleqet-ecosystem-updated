export const metadata = {
  title: 'Portfolio | Showcase Your Work on Beleqet',
  description:
    'Create a public portfolio page and show employers and clients your best work. Free for all Beleqet members.',
};

export default function PortfolioPage() {
  const sampleProjects = [
    {
      title: 'E-commerce Redesign',
      category: 'UI/UX',
      author: 'Hana T.',
      role: 'Product Designer',
      views: '1.2K',
    },
    {
      title: 'Telebirr Integration API',
      category: 'Backend',
      author: 'Dawit K.',
      role: 'Backend Engineer',
      views: '870',
    },
    {
      title: 'NGO Annual Report',
      category: 'Graphic Design',
      author: 'Sara M.',
      role: 'Graphic Designer',
      views: '640',
    },
    {
      title: 'React Native Mobile App',
      category: 'Mobile Dev',
      author: 'Yonas B.',
      role: 'Mobile Developer',
      views: '2.1K',
    },
    {
      title: 'Coffee Brand Identity',
      category: 'Branding',
      author: 'Liya A.',
      role: 'Brand Designer',
      views: '980',
    },
    {
      title: 'Market Research Report',
      category: 'Writing',
      author: 'Abel N.',
      role: 'Content Writer',
      views: '450',
    },
  ];

  return (
    <main className="portfolio-page">
      <div className="portfolio-hero">
        <div className="sec-eyebrow" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Portfolio
        </div>
        <h1 className="portfolio-hero__h">
          Show the work.
          <br />
          <span style={{ color: 'var(--lime)' }}>Get hired for it.</span>
        </h1>
        <p className="portfolio-hero__sub">
          Create a public portfolio page linked to your Beleqet profile. Employers and clients
          browse real work — not just a CV bullet point.
        </p>
        <div className="portfolio-hero__btns">
          <a className="btn btn-lime" href="/login?tab=signup&redirect=/portfolio/create">
            Create My Portfolio →
          </a>
          <a className="btn btn-outline-hero" href="#browse">
            Browse Portfolios
          </a>
        </div>
      </div>

      <section className="portfolio-section" id="browse">
        <div className="sec-head">
          <div>
            <div className="sec-eyebrow">Featured Work</div>
            <h2 className="sec-h">Ethiopian talent in action.</h2>
          </div>
          <a className="view-all" href="/portfolio/browse">
            Browse all
            <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
        <div className="portfolio-grid">
          {sampleProjects.map((p, i) => (
            <div key={i} className="portfolio-card">
              <div
                className="portfolio-card__thumb"
                style={{
                  background: ['#123626', '#1B4A33', '#0E2C1E', '#183D2A', '#123626', '#0A2018'][
                    i % 6
                  ],
                }}
                aria-hidden="true"
              >
                <span className="portfolio-card__initials">
                  {p.title
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')}
                </span>
              </div>
              <div className="portfolio-card__body">
                <span className="portfolio-card__cat">{p.category}</span>
                <h3>{p.title}</h3>
                <div className="portfolio-card__meta">
                  <span>{p.author}</span>
                  <span className="portfolio-card__sep">·</span>
                  <span>{p.role}</span>
                  <span className="portfolio-card__sep">·</span>
                  <span>{p.views} views</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="portfolio-section portfolio-section--cream">
        <div className="sec-eyebrow">How it works</div>
        <h2 className="sec-h" style={{ marginBottom: 40 }}>
          Build your portfolio in minutes.
        </h2>
        <div className="portfolio-steps">
          {[
            {
              n: '01',
              title: 'Add your projects',
              body: 'Upload images, links, or descriptions of your best work.',
            },
            {
              n: '02',
              title: 'Set your skills & rates',
              body: 'Tell employers what you do and what you charge.',
            },
            {
              n: '03',
              title: 'Share your link',
              body: 'Your portfolio gets a public URL — share it on LinkedIn, Telegram, or in applications.',
            },
            {
              n: '04',
              title: 'Get discovered',
              body: 'Employers and clients browse portfolios when looking for freelance talent.',
            },
          ].map(({ n, title, body }) => (
            <div key={n} className="portfolio-step">
              <span className="portfolio-step__num">{n}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="portfolio-cta-band">
        <h2>Your work deserves to be seen.</h2>
        <p>Free portfolio pages for all Beleqet members.</p>
        <a className="btn btn-lime" href="/login?tab=signup" style={{ marginTop: 24 }}>
          Create My Portfolio Free →
        </a>
      </div>
    </main>
  );
}
