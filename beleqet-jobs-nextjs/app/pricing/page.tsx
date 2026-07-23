import { Check, Zap, Building2, Rocket, ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import { pricingPageMetadata } from "@/lib/seo/generate-metadata";
import { fetchPlans, type Plan } from "@/lib/api";

export const metadata = pricingPageMetadata();
export const revalidate = 60;

// Cosmetic-only lookup — purely for icon/highlight, keyed by position so the
// page still renders sensibly if an admin renames or reorders plans.
const PRESENTATION = [
  { icon: Zap, highlight: false, badge: null as string | null },
  { icon: Rocket, highlight: true, badge: "Most Popular" },
  { icon: Building2, highlight: false, badge: null as string | null },
];

function formatPrice(plan: Plan): { priceLabel: string; period: string; hasPrice: boolean } {
  if (plan.priceAmount === 0) {
    return { priceLabel: "Free", period: "forever", hasPrice: false };
  }
  const major = plan.priceAmount / 100;
  const amount = major % 1 === 0 ? major.toString() : major.toFixed(2);
  return {
    priceLabel: `${plan.currency} ${amount}`,
    period: plan.interval === "YEARLY" ? "per year" : "per month",
    hasPrice: true,
  };
}

function planFeatureList(plan: Plan): string[] {
  if (!plan.features) return [];
  return Object.entries(plan.features).map(([key, value]) => {
    if (typeof value === "boolean") return value ? humanizeKey(key) : `No ${humanizeKey(key).toLowerCase()}`;
    if (value === -1) return `Unlimited ${humanizeKey(key).toLowerCase()}`;
    return `${humanizeKey(key)}: ${value}`;
  });
}

function humanizeKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

const faqs = [
  {
    q: "How does billing work?",
    a: "Paid plans renew automatically every billing period via PayPal. You can cancel anytime from your profile — access continues until the end of the period you already paid for.",
  },
  {
    q: "What happens if I cancel?",
    a: "Your subscription stays active until the current billing period ends, then it won't renew. You can resubscribe at any time.",
  },
  {
    q: "What happens when a subscription expires?",
    a: "You lose access to that plan's paid features and are notified by email/in-app a few days before expiry, and again once it expires.",
  },
  {
    q: "Is the free plan really free?",
    a: "Yes — no credit card required to get started.",
  },
];

export default async function PricingPage() {
  const plans = await fetchPlans();

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
        {plans.length === 0 ? (
          <p className="text-center text-muted">
            Plans are being updated. Please check back shortly.
          </p>
        ) : (
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan, index) => {
              const presentation = PRESENTATION[index % PRESENTATION.length];
              const Icon = presentation.icon;
              const { priceLabel, period, hasPrice } = formatPrice(plan);
              const features = planFeatureList(plan);
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col overflow-hidden rounded-3xl border ${
                    presentation.highlight
                      ? "border-brandGreen bg-primary text-white shadow-[0_20px_60px_-15px_rgba(0,101,59,0.4)]"
                      : "border-border bg-white shadow-card"
                  }`}
                >
                  {presentation.badge && (
                    <div className="absolute right-5 top-5 flex items-center gap-1 rounded-full bg-[#d8ff3e] px-3 py-1 text-[11px] font-extrabold text-primary">
                      <Star className="h-3 w-3 fill-primary" />
                      {presentation.badge}
                    </div>
                  )}

                  <div className="p-7 pb-6">
                    <span
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${
                        presentation.highlight
                          ? "bg-white/10 text-[#d8ff3e]"
                          : "bg-brandGreen/10 text-brandGreen"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <h2
                      className={`mt-4 text-xl font-black ${
                        presentation.highlight ? "text-white" : "text-primary"
                      }`}
                    >
                      {plan.name}
                    </h2>

                    <div className="mt-5 flex items-end gap-1">
                      <span
                        className={`text-4xl font-black leading-none ${
                          presentation.highlight ? "text-white" : "text-primary"
                        }`}
                      >
                        {priceLabel}
                      </span>
                      {hasPrice && (
                        <span
                          className={`mb-0.5 text-sm ${
                            presentation.highlight ? "text-white/50" : "text-muted"
                          }`}
                        >
                          /{period}
                        </span>
                      )}
                    </div>
                    {plan.description && (
                      <p
                        className={`mt-3 text-sm leading-relaxed ${
                          presentation.highlight ? "text-white/60" : "text-muted"
                        }`}
                      >
                        {plan.description}
                      </p>
                    )}
                  </div>

                  <div
                    className={`mx-6 border-t ${
                      presentation.highlight ? "border-white/10" : "border-border"
                    }`}
                  />

                  <ul className="flex-1 space-y-3 p-7">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <span
                          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            presentation.highlight
                              ? "bg-white/10 text-[#d8ff3e]"
                              : "bg-brandGreen/10 text-brandGreen"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        <span
                          className={presentation.highlight ? "text-white/80" : "text-ink/80"}
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="p-7 pt-0">
                    <Link
                      href={plan.priceAmount === 0 ? "/register" : `/checkout?planId=${plan.id}`}
                      className={`group flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-all ${
                        presentation.highlight
                          ? "bg-[#d8ff3e] text-primary hover:bg-[#c8ef2e]"
                          : "bg-primary text-white hover:bg-brandGreen"
                      }`}
                    >
                      {plan.priceAmount === 0 ? "Get started" : `Subscribe to ${plan.name}`}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            Ready to get more from Beleqet?
          </p>
          <h2 className="mt-3 text-3xl font-black">
            Start on the Free plan, upgrade anytime
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-white/60 leading-relaxed">
            No contracts, no commitments. Cancel a paid plan whenever you like —
            your access continues until the period you already paid for ends.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-[#d8ff3e] px-7 py-3 text-sm font-extrabold text-primary hover:bg-[#c8ef2e] transition-colors"
            >
              Get started free <ArrowRight className="h-4 w-4" />
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
