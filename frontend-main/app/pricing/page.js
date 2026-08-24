export const metadata = {
  title: 'Pricing | Beleqet Jobs & Freelance Plans',
  description:
    'Simple, transparent pricing for job seekers, freelancers, and employers. Start free — upgrade when you need more.',
};

const PLANS = [
  {
    name: 'Free',
    price: '0',
    period: 'forever',
    desc: 'Everything you need to get started.',
    cta: 'Get Started Free',
    ctaHref: '/login?tab=signup',
    highlight: false,
    features: [
      '5 job applications / month',
      '1 active job post (employers)',
      'Basic CV builder',
      'Job alerts via Telegram',
      'Freelance gig browsing',
    ],
  },
  {
    name: 'Pro',
    price: '299',
    period: 'ETB / month',
    desc: 'For active job seekers and growing freelancers.',
    cta: 'Start Pro',
    ctaHref: '/login?tab=signup&plan=pro',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Unlimited job applications',
      'Priority application badge',
      'Full CV builder + AI suggestions',
      'Portfolio page (public link)',
      'Freelance proposal submissions',
      'Escrow-protected payments',
      'Chat to Text transcriptions (50/mo)',
    ],
  },
  {
    name: 'Business',
    price: '1,499',
    period: 'ETB / month',
    desc: 'For employers and agencies hiring at scale.',
    cta: 'Contact Sales',
    ctaHref: '/contact?plan=business',
    highlight: false,
    features: [
      'Unlimited job postings',
      'AI candidate matching',
      'Applicant tracking dashboard',
      'Promoted job listings',
      'Direct candidate messaging',
      'Escrow freelance hiring',
      'Analytics & export',
      'Dedicated account manager',
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <div className="pricing-hero">
        <div className="sec-eyebrow" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Pricing
        </div>
        <h1 className="pricing-hero__h">Simple, honest pricing.</h1>
        <p className="pricing-hero__sub">
          No hidden fees. No pay-to-apply. Start free and upgrade when you&apos;re ready.
        </p>
      </div>

      <section className="pricing-section">
        <div className="pricing-grid">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`pricing-card${plan.highlight ? ' pricing-card--highlight' : ''}`}
            >
              {plan.badge && <span className="pricing-badge">{plan.badge}</span>}
              <h2 className="pricing-plan-name">{plan.name}</h2>
              <div className="pricing-price">
                <b>{plan.price}</b>
                <span>{plan.period}</span>
              </div>
              <p className="pricing-desc">{plan.desc}</p>
              <a className={`btn${plan.highlight ? ' btn-lime' : ' btn-dark'}`} href={plan.ctaHref}>
                {plan.cta}
              </a>
              <ul className="pricing-features">
                {plan.features.map((f) => (
                  <li key={f}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pricing-faq">
          <h2 className="sec-h" style={{ textAlign: 'center', marginBottom: 32 }}>
            Frequently Asked Questions
          </h2>
          <div className="pricing-faq-list">
            {[
              {
                q: 'Is the free plan really free forever?',
                a: 'Yes. No credit card required. The free plan gives you everything to get started with no time limit.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'Chapa, Telebirr, and major cards. All billing is in Ethiopian Birr (ETB).',
              },
              {
                q: 'What is BeleqetSafe Escrow?',
                a: 'Escrow holds client funds securely until you approve the delivered work. Funds are released to your Chapa or Telebirr account instantly after approval.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes — cancel before your next billing date and you will not be charged again. Your account downgrades to Free.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="pricing-faq-item">
                <h3>{q}</h3>
                <p>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
