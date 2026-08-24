export const metadata = {
  title: 'For Employers | Hire Ethiopian Talent on Beleqet',
  description:
    'Post jobs, find verified candidates, and manage your hiring pipeline. Beleqet connects Ethiopian employers with qualified job seekers and freelancers.',
};

export default function ForEmployersPage() {
  return (
    <main className="emp-page">
      <div className="emp-hero">
        <div className="emp-hero__inner">
          <div className="sec-eyebrow" style={{ color: 'rgba(255,255,255,0.65)' }}>
            For Employers
          </div>
          <h1 className="emp-hero__h">
            Find the right person.
            <br />
            <span style={{ color: 'var(--lime)' }}>Faster than ever.</span>
          </h1>
          <p className="emp-hero__sub">
            Post jobs to thousands of active Ethiopian professionals. Screen, shortlist, and hire —
            all from one dashboard.
          </p>
          <div className="emp-hero__btns">
            <a className="btn btn-lime" href="/post-job">
              Post a Job Free
            </a>
            <a className="btn btn-outline-hero" href="/pricing">
              View Pricing
            </a>
          </div>
        </div>
      </div>

      <section className="emp-section">
        <div className="sec-eyebrow">Why Beleqet for hiring</div>
        <h2 className="sec-h" style={{ marginBottom: 40 }}>
          Everything you need to hire right.
        </h2>
        <div className="emp-features">
          {[
            {
              icon: '🎯',
              title: 'AI Candidate Matching',
              body: 'Our AI surfaces the most relevant candidates based on your job description, not just keyword search.',
            },
            {
              icon: '✅',
              title: 'Verified Profiles',
              body: 'Every candidate profile is verified. You see real skills, real education, real references.',
            },
            {
              icon: '📊',
              title: 'Applicant Dashboard',
              body: 'Track all applications, shortlist candidates, and communicate — in one clean interface.',
            },
            {
              icon: '💬',
              title: 'Direct Messaging',
              body: 'Reach candidates directly without back-and-forth email chains.',
            },
            {
              icon: '🔒',
              title: 'Escrow Freelance Hiring',
              body: 'Hire freelancers safely with BeleqetSafe Escrow — funds held until work is approved.',
            },
            {
              icon: '📢',
              title: 'Promoted Listings',
              body: 'Boost your job listing to the top of search results and reach more candidates faster.',
            },
          ].map(({ icon, title, body }) => (
            <div key={title} className="emp-feature">
              <span className="emp-feature__icon">{icon}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="emp-section emp-section--cream">
        <div className="sec-eyebrow">How it works</div>
        <h2 className="sec-h" style={{ marginBottom: 40 }}>
          Hire in 4 steps.
        </h2>
        <div className="emp-steps">
          {[
            {
              n: '01',
              title: 'Post your job',
              body: 'Create a listing in under 5 minutes. Salary transparency is required — it attracts better candidates.',
            },
            {
              n: '02',
              title: 'Review candidates',
              body: 'Qualified applicants appear in your dashboard. AI ranking puts the best matches at the top.',
            },
            {
              n: '03',
              title: 'Shortlist & interview',
              body: 'Save candidates, send messages, and schedule interviews — all inside Beleqet.',
            },
            {
              n: '04',
              title: 'Hire with confidence',
              body: 'Make your offer through the platform. For freelancers, fund escrow and release on approval.',
            },
          ].map(({ n, title, body }) => (
            <div key={n} className="emp-step">
              <span className="emp-step__num">{n}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="emp-cta-band">
        <h2>Start hiring today.</h2>
        <p>Your first job post is free. No credit card required.</p>
        <a className="btn btn-lime" href="/post-job" style={{ marginTop: 24 }}>
          Post a Job Free →
        </a>
      </div>
    </main>
  );
}
