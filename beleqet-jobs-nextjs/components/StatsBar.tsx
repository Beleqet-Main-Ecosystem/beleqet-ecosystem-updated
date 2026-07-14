import { useTranslations } from "next-intl";
import { Briefcase, Building2, Users, Smile, type LucideIcon } from "lucide-react";
import { stats } from "@/lib/mockData";

const iconMap: Record<string, LucideIcon> = {
  briefcase:  Briefcase,
  "building-2": Building2,
  users:      Users,
  smile:      Smile,
};

/** Maps the English mockData label key to the i18n message key */
const labelKeyMap: Record<string, string> = {
  "Active Jobs":              "activeJobs",
  "Hiring Companies":         "hiringCompanies",
  "Registered Job Seekers":   "registeredSeekers",
  "Satisfaction Rate":        "satisfactionRate",
};

export default function StatsBar() {
  const t = useTranslations("stats");

  return (
    <section className="border-y border-primary/10 bg-[#d8ff3e]">
      <div className="container-page grid grid-cols-2 sm:grid-cols-4">
        {stats.map((stat) => {
          const Icon = iconMap[stat.icon] ?? Briefcase;
          const labelKey = labelKeyMap[stat.label] ?? "activeJobs";
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3.5 border-primary/10 px-3 py-7 even:border-l sm:border-l sm:px-6 first:sm:border-l-0"
            >
              <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-[#d8ff3e] lg:inline-flex">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-black leading-none tracking-tight text-primary">
                  {stat.value}
                </p>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-primary/60">
                  {t(labelKey as any)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
