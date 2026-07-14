import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness } from "lucide-react";

export default function Footer() {
  const t = useTranslations("footer");

  const footerColumns = [
    {
      title: t("forJobSeekers"),
      links: [
        { label: t("findJobs"),        href: "/jobs" },
        { label: t("browseCategories"),href: "/jobs" },
        { label: t("cvMaker"),         href: "/cv-maker" },
        { label: t("telegramAlerts"),  href: "https://t.me/BeleqetJobs" },
      ],
    },
    {
      title: t("forEmployers"),
      links: [
        { label: t("postJob"),         href: "/post-job" },
        { label: t("findCandidates"),  href: "/post-job" },
        { label: t("pricingLink"),     href: "/pricing" },
        { label: t("support"),         href: "/contact" },
      ],
    },
    {
      title: t("contact"),
      links: [
        { label: t("address"),         href: "/contact" },
        { label: t("website"),         href: "https://beleqet.com" },
        { label: t("telegramChannel"), href: "https://t.me/BeleqetJobs" },
        { label: t("supportCenter"),   href: "/contact" },
      ],
    },
  ];

  return (
    <footer className="bg-primary text-white">
      <div className="container-page grid grid-cols-1 gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#d8ff3e] text-primary">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            Beleqet<span className="text-[#d8ff3e]">.</span>
          </Link>
          <p className="mt-5 max-w-xs text-sm leading-6 text-white/55">
            {t("tagline")}
          </p>
        </div>

        {footerColumns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-5 text-xs font-extrabold uppercase tracking-[.16em] text-[#d8ff3e]">
              {col.title}
            </h4>
            <ul className="space-y-2.5">
              {col.links.map((link) => {
                const isExternal =
                  link.href.startsWith("http") || link.href.startsWith("//");
                return (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      {...(isExternal ? { rel: "noopener noreferrer", target: "_blank" } : {})}
                      className="group inline-flex items-center gap-1 text-sm text-white/60 transition-colors hover:text-white"
                    >
                      {link.label}
                      <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-white/40 sm:flex-row">
          <p>{t("copyright", { year: new Date().getFullYear() })}</p>
          <p>{t("builtFor")}</p>
        </div>
      </div>
    </footer>
  );
}
