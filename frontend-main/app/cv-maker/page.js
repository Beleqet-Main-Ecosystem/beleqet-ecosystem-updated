export const metadata = {
  title: 'CV Maker | Build a Professional CV for Ethiopian Jobs',
  description:
    'Create a professional CV tailored for Ethiopian employers in minutes. ATS-optimised templates, Amharic support, and PDF export — free.',
};

export default function CvMakerPage() {
  return (
    <main className="cv-page">
      <div className="cv-hero">
        <div className="cv-hero__inner">
          <div className="sec-eyebrow" style={{ color: 'rgba(255,255,255,0.65)' }}>
            CV Maker
          </div>
          <h1 className="cv-hero__h">
            A CV that gets you <span style={{ color: 'var(--lime)' }}>noticed</span>.
          </h1>
          <p className="cv-hero__sub">
            Build a professional, ATS-friendly CV in minutes. Templates designed for Ethiopian
            employers, with Amharic name and language support.
          </p>
          <a className="btn btn-lime" href="/cv-maker/builder" style={{ marginTop: 8 }}>
            Build My CV Free →
          </a>
        </div>
      </div>

      <section className="cv-section">
        <div className="sec-eyebrow">Features</div>
        <h2 className="sec-h" style={{ marginBottom: 40 }}>
          Everything in a great CV, simplified.
        </h2>
        <div className="cv-features">
          {[
            {
              icon: '📄',
              title: 'Professional Templates',
              body: '6 clean, ATS-friendly templates used by thousands of Ethiopian job seekers.',
            },
            {
              icon: '🇪🇹',
              title: 'Amharic Support',
              body: 'Add your name, bio, and skills in Amharic. Bilingual CVs supported.',
            },
            {
              icon: '🤖',
              title: 'AI Content Suggestions',
              body: 'Stuck on your summary? AI drafts bullet points tailored to your role and industry.',
            },
            {
              icon: '📥',
              title: 'PDF Export',
              body: 'Download a crisp, print-ready PDF instantly. No watermarks on free plan.',
            },
            {
              icon: '🔗',
              title: 'Shareable Link',
              body: 'Get a public link to share with employers directly — no download needed.',
            },
            {
              icon: '🔄',
              title: 'Auto-fill from Profile',
              body: 'Your Beleqet profile data pre-fills the CV builder. One source of truth.',
            },
          ].map(({ icon, title, body }) => (
            <div key={title} className="cv-feature">
              <span className="cv-feature__icon">{icon}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cv-section cv-section--cream">
        <div className="cv-templates">
          <div className="sec-eyebrow">Templates</div>
          <h2 className="sec-h" style={{ marginBottom: 32 }}>
            Pick a style, make it yours.
          </h2>
          <div className="cv-template-grid">
            {['Classic', 'Modern', 'Minimal', 'Bold', 'Professional', 'Creative'].map((name) => (
              <div key={name} className="cv-template-card">
                <div className="cv-template-preview" aria-hidden="true">
                  <div className="cv-tp-header" />
                  <div className="cv-tp-line" style={{ width: '60%' }} />
                  <div className="cv-tp-line" style={{ width: '80%' }} />
                  <div className="cv-tp-line" style={{ width: '45%' }} />
                </div>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="cv-cta-band">
        <h2>Your next job starts with a great CV.</h2>
        <p>Free forever for job seekers. Premium features unlock with a Pro plan.</p>
        <a className="btn btn-lime" href="/cv-maker/builder" style={{ marginTop: 20 }}>
          Start Building →
        </a>
      </div>
    </main>
  );
}
