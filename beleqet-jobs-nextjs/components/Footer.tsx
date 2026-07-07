import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness } from "lucide-react";

const footerColumns = [
  {
    title: "For Job Seekers",
    links: [
      { label: "Find Jobs", href: "/jobs" },
      { label: "Browse Categories", href: "/jobs" },
      { label: "CV Maker", href: "/cv-maker" },
      { label: "Telegram Alerts", href: "https://t.me/BeleqetJobs" },
    ],
  },
  {
    title: "For Employers",
    links: [
      { label: "Post a Job", href: "/post-job" },
      { label: "Find Candidates", href: "/post-job" },
      { label: "Pricing", href: "/pricing" },
      { label: "Support", href: "/contact" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: "Addis Ababa, Ethiopia", href: "/contact" },
      { label: "beleqet.com", href: "https://beleqet.com" },
      { label: "Telegram Channel", href: "https://t.me/BeleqetJobs" },
      { label: "Support Center", href: "/contact" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-primary text-white">
      <div className="container-page grid grid-cols-1 gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#d8ff3e] text-primary">
              <BriefcaseBusiness className="h-5 w-5" />
            </span>
            Beleqet<span className="text-[#d8ff3e]">.</span>
          </Link>
          <p className="mt-5 max-w-xs text-sm leading-6 text-white/55">
            Beleqet helps job seekers discover opportunities and employers
            connect with the right talent across Ethiopia.
          </p>
        </div>

        {footerColumns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-5 text-xs font-extrabold uppercase tracking-[.16em] text-[#d8ff3e]">
              {col.title}
            </h4>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="group inline-flex items-center gap-1 text-sm text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-white/40 sm:flex-row">
          <p>
            © {new Date().getFullYear()} Beleqet Vacancy Platform. All rights
            reserved.
          </p>
          <p>Addis Ababa · Built for Ethiopian talent.</p>
        </div>
      </div>
    </footer>
  );
}
