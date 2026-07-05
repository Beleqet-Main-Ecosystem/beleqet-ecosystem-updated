import Link from "next/link";
import { MapPin, Building2 } from "lucide-react";
import type { Job } from "@/lib/api";
import SaveJobButton from "@/components/SaveJobButton";

export default function JobCard({
  job,
  variant = "dark",
}: {
  job: Job;
  variant?: "dark" | "light";
}) {
  const isLight = variant === "light";

  return (
    <article
      className={`group flex min-h-[280px] flex-col rounded-[22px] border p-5 transition-all hover:-translate-y-1 hover:border-[#d8ff3e]/60 ${
        isLight
          ? "border-primary/10 bg-white shadow-card hover:shadow-lg"
          : "border-white/10 bg-white/[.07] hover:bg-white/[.1]"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#d8ff3e] text-primary">
          <Building2 className="h-5 w-5" />
        </span>
        <SaveJobButton jobId={job.id} light={isLight} />
      </div>

      <Link href={`/jobs/${job.id}`} className="flex flex-1 flex-col">
        <h3
          className={`text-cardH3 mt-5 line-clamp-2 leading-snug ${
            isLight ? "text-primary" : "text-white"
          }`}
        >
          {job.title}
        </h3>
        <p className={`mt-1 text-sm ${isLight ? "text-ink" : "text-white/55"}`}>
          {job.company}
        </p>

        <div
          className={`mt-3 flex items-center gap-1 text-xs ${
            isLight ? "text-muted" : "text-white/50"
          }`}
        >
          <MapPin className="h-3.5 w-3.5" />
          {job.location}
        </div>

        <div
          className={`mt-auto flex items-center justify-between border-t pt-4 ${
            isLight ? "border-primary/10" : "border-white/10"
          }`}
        >
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isLight
                ? "bg-brandGreen/10 text-brandGreen"
                : "bg-white/10 text-white"
            }`}
          >
            {job.type}
          </span>
          <span className={`text-[11px] ${isLight ? "text-muted" : "text-white/40"}`}>
            {job.postedAgo}
          </span>
        </div>
      </Link>
    </article>
  );
}
