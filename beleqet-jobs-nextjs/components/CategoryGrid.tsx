import Link from "next/link";
import {
  Laptop,
  Megaphone,
  Landmark,
  HeartPulse,
  GraduationCap,
  Cog,
  Briefcase,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/api";

const iconMap: Record<string, LucideIcon> = {
  laptop: Laptop,
  megaphone: Megaphone,
  landmark: Landmark,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  cog: Cog,
  briefcase: Briefcase,
  "more-horizontal": MoreHorizontal,
};

export default function CategoryGrid({
  categories,
}: {
  categories: Category[];
}) {
  if (!categories.length) return null;

  return (
    <section className="container-page py-20">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-brandGreen">
            Explore your field
          </p>
          <h2 className="text-sectionH2 tracking-tight text-primary">
            There’s a place for your talent.
          </h2>
          <p className="mt-2 text-sm text-muted">
            Start with an industry and discover where your experience can take
            you.
          </p>
        </div>
        <Link
          href="/jobs"
          className="hidden sm:inline-block text-sm font-semibold text-brandGreen hover:underline shrink-0"
        >
          View all categories →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {categories.map((cat) => {
          const Icon = iconMap[cat.icon] ?? Briefcase;
          return (
            <Link
              key={cat.id}
              href={`/jobs?category=${cat.id}`}
              className="group flex min-h-40 flex-col justify-between rounded-[22px] border border-primary/10 bg-white p-4 text-left transition-all hover:-translate-y-1 hover:border-primary hover:bg-primary"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#d8ff3e] text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <span className="block text-sm font-extrabold text-primary group-hover:text-white">
                  {cat.label}
                </span>
                {cat.count ? (
                  <span className="mt-1 block text-[11px] text-muted group-hover:text-white/55">
                    {cat.count} jobs
                  </span>
                ) : (
                  <span className="mt-1 block text-[11px] text-muted group-hover:text-white/55">
                    View openings →
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
