import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUpRight, BellRing, ShieldCheck, WandSparkles } from "lucide-react";

export default function WhyChoose() {
  const t = useTranslations("why");

  const features = [
    {
      icon: ShieldCheck,
      number: "01",
      title: t("feature1Title"),
      desc: t("feature1Desc"),
    },
    {
      icon: WandSparkles,
      number: "02",
      title: t("feature2Title"),
      desc: t("feature2Desc"),
    },
    {
      icon: BellRing,
      number: "03",
      title: t("feature3Title"),
      desc: t("feature3Desc"),
    },
  ];

  return (
    <section className="container-page py-20 lg:py-24">
      <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-brandGreen">
            {t("sectionBadge")}
          </p>
          <h2 className="max-w-md text-[clamp(2.25rem,4vw,4rem)] font-black leading-[.98] tracking-[-.05em] text-primary">
            {t("heading1")}
            <br />
            {t("heading2")}
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-6 text-muted">
            {t("subheading")}
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-brandGreen"
          >
            {t("createProfile")} <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="divide-y divide-primary/10 border-y border-primary/10">
          {features.map((feature) => (
            <div
              key={feature.number}
              className="group grid grid-cols-[auto_1fr] gap-5 py-7 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-primary/10 bg-white text-brandGreen">
                <feature.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-extrabold text-primary">{feature.title}</h3>
                <p className="mt-1 max-w-lg text-sm leading-6 text-muted">{feature.desc}</p>
              </div>
              <span className="hidden text-4xl font-black text-primary/10 sm:block">
                {feature.number}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
