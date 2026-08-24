export const metadata = {
  title: 'About Beleqet | Ethiopian Talent Marketplace',
  description:
    'Beleqet connects Ethiopian professionals with credible employers. Our purpose: shorten the distance between talent and opportunity.',
};

export default function AboutPage() {
  return (
    <main className="about-page">
      <div className="about-hero">
        <div className="about-hero__inner">
          <div className="sec-eyebrow" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Our Purpose
          </div>
          <h1 className="about-hero__h">Ethiopian talent deserves better access.</h1>
          <p className="about-hero__sub">
            Beleqet connects people with credible employers through one focused career marketplace —
            making discovery, application, and hiring simpler for everyone.
          </p>
        </div>
      </div>

      <section className="about-section">
        <div className="about-two-col">
          <div>
            <div className="sec-eyebrow">Why we exist</div>
            <h2 className="sec-h">
              The distance between talent and opportunity should be shorter.
            </h2>
          </div>
          <div>
            <p className="sec-p" style={{ marginBottom: 16 }}>
              Too many skilled professionals spend weeks searching across scattered platforms,
              sending CVs into silence, and waiting months for outcomes. Employers face the same
              friction on the other side.
            </p>
            <p className="sec-p">
              Beleqet brings job discovery, CV tools, applications, employer profiling, and direct
              talent search into a single platform — built first for the Ethiopian context.
            </p>
          </div>
        </div>
      </section>

      <section className="about-stats-section">
        <div className="about-stats">
          {[
            { value: '10K+', label: 'Active Jobs' },
            { value: '5K+', label: 'Hiring Companies' },
            { value: '50K+', label: 'Registered Seekers' },
            { value: 'One', label: 'Unified Platform' },
          ].map(({ value, label }) => (
            <div key={label} className="about-stat">
              <b className="about-stat__value">{value}</b>
              <span className="about-stat__label">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="about-section">
        <div className="sec-eyebrow" style={{ marginBottom: 8 }}>
          What makes us
        </div>
        <h2 className="sec-h" style={{ marginBottom: 40 }}>
          A marketplace people can rely on.
        </h2>
        <div className="about-cards">
          {[
            {
              title: 'Trust before traffic',
              body: 'Every job listing, employer profile, and freelancer review is verified before going live.',
            },
            {
              title: 'Built for local reality',
              body: "Designed around Ethiopia's labour market, payment rails (Chapa, Telebirr), and language needs — Amharic first.",
            },
            {
              title: 'Opportunity with dignity',
              body: 'Salary, contract type, and employer details upfront. No hidden conditions, no pay-to-apply gates.',
            },
          ].map(({ title, body }) => (
            <div key={title} className="about-card">
              <span className="about-card__dot" aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="about-cta-band">
        <h2>Make your next move.</h2>
        <p>
          Whether you&apos;re searching for a role or building a team — Beleqet is where it starts.
        </p>
        <div className="about-cta-btns">
          <a className="btn btn-lime" href="/jobs">
            Find Jobs
          </a>
          <a className="btn btn-outline-hero" href="/post-job">
            Hire Talent
          </a>
        </div>
      </div>
    </main>
  );
}
