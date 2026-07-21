import { Check, Zap, Building2, Rocket, ArrowRight, Star } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Pricing | Beleqet Jobs",
  description:
    "Simple, transparent pricing for Ethiopian employers. Post jobs and reach thousands of qualified candidates on Beleqet.",
};

const plans = [
  {
    icon: Zap,
    name: "Basic",
    tagline: "Get started for free",
    price: null,
    priceLabel: "Free",
    period: "forever",
    desc: "Perfect for small businesses posting their first job listing.",
    features: [
      "1 active job listing",
      "30 days visibility",
      "Standard search placement",
      "Applicant management dashboard",
      "Email notifications",
    ],
    href: "/post-job",
    action: "Post a free job",
    highlight: false,
    badge: null,
  },
  {
    icon: Rocket,
    name: "Featured",
    tagline: "Most popular choice",
    price: 1500,
    priceLabel: "ETB 1,500",
    period: "per month",
    desc: "More reach, more applicants. Ideal for growing teams.",
    features: [
      "Up to 5 active listings",
      "60 days visibility per listing",
      "Featured badge on all jobs",
      "Priority search placement",
      "Telegram channel boost",
      "Applicant CSV export",
    ],
    href: "/contact",
    action: "Get Featured",
    highlight: true,
    badge: "Most Popular",
  },
  {
    icon: Building2,
    name: "Enterprise",
    tagline: "Built for scale",
    price: null,
    priceLabel: "Custom",
    period: "tailored to you",
    desc: "High-volume hiring with a dedicated partner by your side.",
    features: [
      "Unlimited job listings",
      "Dedicated account manager",
      "Custom employer branding page",
      "Priority candidate screening",
      "API access & integrations",
      "SLA-backed support",
    ],
    href: "/contact",
    action: "Contact sales",
    highlight: false,
    badge: null,
  },
];

const faqs = [
  {
    q: "Can I upgrade or downgrade my plan?",
    a: "Yes. You can upgrade anytime and the difference will be prorated. Downgrades take effect at the end of the billing period.",
  },
  {
    q: "How do I pay?",
    a: "We accept Telebirr, CBE Birr, and bank transfers. Contact our sales team after selecting a plan.",
  },
  {
    q: "Is the free plan really free?",
    a: "Absolutely. No credit card required. You can post one active job listing at no cost, for as long as you need.",
  },
  {
    q: "What happens when my listing expires?",
    a: "Your job becomes invisible to job seekers. You can renew it or upgrade to a paid plan to extend visibility.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      {/* Hero */}
      <section className="bg-primary py-20 text-white">
        <div className="container-page text-center">
          <span className="inline-block rounded-full bg-[#d8ff3e]/15 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
            Pricing
          </span>
          <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-white/65 leading-relaxed">
            Pay for reach, not features. Every plan includes access to
            Ethiopia&apos;s largest verified talent network.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="container-page py-16">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`relative flex flex-col overflow-hidden rounded-3xl border ${
                  plan.highlight
                    ? "border-brandGreen bg-primary text-white shadow-[0_20px_60px_-15px_rgba(0,101,59,0.4)]"
                    : "border-border bg-white shadow-card"
                }`}
              >
                {plan.badge && (
                  <div className="absolute right-5 top-5 flex items-center gap-1 rounded-full bg-[#d8ff3e] px-3 py-1 text-[11px] font-extrabold text-primary">
                    <Star className="h-3 w-3 fill-primary" />
                    {plan.badge}
                  </div>
                )}

                <div className="p-7 pb-6">
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${
                      plan.highlight
                        ? "bg-white/10 text-[#d8ff3e]"
                        : "bg-brandGreen/10 text-brandGreen"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>

                  <p
                    className={`mt-4 text-xs font-extrabold uppercase tracking-widest ${
                      plan.highlight ? "text-[#d8ff3e]" : "text-brandGreen"
                    }`}
                  >
                    {plan.tagline}
                  </p>
                  <h2
                    className={`mt-1 text-xl font-black ${
                      plan.highlight ? "text-white" : "text-primary"
                    }`}
                  >
                    {plan.name}
                  </h2>

                  <div className="mt-5 flex items-end gap-1">
                    <span
                      className={`text-4xl font-black leading-none ${
                        plan.highlight ? "text-white" : "text-primary"
                      }`}
                    >
                      {plan.priceLabel}
                    </span>
                    {plan.price !== null && (
                      <span
                        className={`mb-0.5 text-sm ${
                          plan.highlight ? "text-white/50" : "text-muted"
                        }`}
                      >
                        /{plan.period}
                      </span>
                    )}
                    {plan.price === null && plan.name !== "Basic" && (
                      <span
                        className={`mb-0.5 text-sm ${
                          plan.highlight ? "text-white/50" : "text-muted"
                        }`}
                      >
                        — {plan.period}
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-3 text-sm leading-relaxed ${
                      plan.highlight ? "text-white/60" : "text-muted"
                    }`}
                  >
                    {plan.desc}
                  </p>
                </div>

                <div
                  className={`mx-6 border-t ${
                    plan.highlight ? "border-white/10" : "border-border"
                  }`}
                />

                <ul className="flex-1 space-y-3 p-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          plan.highlight
                            ? "bg-white/10 text-[#d8ff3e]"
                            : "bg-brandGreen/10 text-brandGreen"
                        }`}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                      <span
                        className={plan.highlight ? "text-white/80" : "text-ink/80"}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="p-7 pt-0">
                  <Link
                    href={plan.href}
                    className={`group flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-all ${
                      plan.highlight
                        ? "bg-[#d8ff3e] text-primary hover:bg-[#c8ef2e]"
                        : "bg-primary text-white hover:bg-brandGreen"
                    }`}
                  >
                    {plan.action}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trusted by strip */}
      <section className="border-y border-border bg-white py-10">
        <div className="container-page text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted">
            Trusted by leading Ethiopian employers
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 text-sm font-extrabold text-primary/40">
            {[
              "ethio telecom",
              "Dashen Bank",
              "Safaricom Ethiopia",
              "TakaCash",
              "Zemen Bank",
              "BN Star Trading",
            ].map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-page py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-black text-primary">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="rounded-2xl border border-border bg-white p-6"
              >
                <p className="font-extrabold text-primary">{faq.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="container-page pb-20">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-primary px-8 py-12 text-center text-white shadow-[0_20px_60px_-15px_rgba(4,22,3,0.4)]">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#d8ff3e]">
            Ready to hire?
          </p>
          <h2 className="mt-3 text-3xl font-black">
            Start reaching candidates today
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-white/60 leading-relaxed">
            No contracts, no commitments. Post your first job free and see the
            results before committing to a paid plan.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/post-job"
              className="inline-flex items-center gap-2 rounded-full bg-[#d8ff3e] px-7 py-3 text-sm font-extrabold text-primary hover:bg-[#c8ef2e] transition-colors"
            >
              Post a free job <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-7 py-3 text-sm font-bold text-white hover:bg-white/10 transition-colors"
            >
              Talk to sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
