"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { popularSearches } from "@/lib/mockData";

export default function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (location.trim()) params.set("loc", location.trim());
    router.push(`/jobs?${params.toString()}`);
  }

  return (
    <section className="hero-grid relative overflow-hidden bg-[#fffdf8]">
      <div className="container-page relative grid min-h-[690px] items-center gap-14 py-16 lg:grid-cols-[1.08fr_.92fr] lg:py-20">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-brandGreen/20 bg-brandGreen/5 px-3.5 py-2 text-xs font-bold text-brandGreen">
            <Sparkles className="h-3.5 w-3.5" /> Ethiopia’s career marketplace
          </div>
          <h1 className="max-w-3xl text-[clamp(3rem,7vw,6.7rem)] font-black leading-[.88] tracking-[-0.065em] text-primary">
            Work that
            <br />
            moves you{" "}
            <span className="relative whitespace-nowrap text-brandGreen">
              forward
              <span className="absolute -bottom-1 left-1 h-2 w-[96%] -rotate-1 rounded-full bg-[#d8ff3e] -z-10" />
            </span>
            .
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted md:text-lg">
            Find meaningful roles from verified Ethiopian employers, build a
            standout profile, and take your next career step with confidence.
          </p>

          <form
            onSubmit={handleSearch}
            className="mt-9 grid max-w-3xl gap-2 rounded-[22px] border border-primary/10 bg-white p-2.5 shadow-[0_20px_70px_rgba(4,22,3,.12)] sm:grid-cols-[1fr_1fr_auto]"
          >
            <label className="flex items-center gap-3 rounded-2xl px-3 py-3">
              <Search className="h-5 w-5 shrink-0 text-brandGreen" />
              <span className="sr-only">Job title or keyword</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Job title or skill"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
              />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border-t border-border px-3 py-3 sm:border-l sm:border-t-0">
              <MapPin className="h-5 w-5 shrink-0 text-brandGreen" />
              <span className="sr-only">Location</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Addis Ababa or remote"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
              />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-bold text-white transition hover:bg-brandGreen"
            >
              Search jobs <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="font-semibold text-ink">Trending:</span>
            {popularSearches.slice(0, 4).map((term) => (
              <button
                key={term}
                onClick={() =>
                  router.push(`/jobs?q=${encodeURIComponent(term)}`)
                }
                className="rounded-full border border-primary/10 bg-white px-3 py-1.5 transition hover:border-brandGreen hover:text-brandGreen"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mx-auto hidden w-full max-w-[520px] lg:block">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#d8ff3e]/60 blur-2xl" />
          <div className="relative rotate-2 rounded-[36px] bg-primary p-6 shadow-[0_35px_80px_rgba(4,22,3,.2)]">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-semibold text-white/50">
                  RECOMMENDED FOR YOU
                </p>
                <p className="mt-1 text-xl font-bold text-white">
                  Fresh opportunities
                </p>
              </div>
              <span className="rounded-full bg-[#d8ff3e] px-3 py-1 text-xs font-extrabold text-primary">
                24 new
              </span>
            </div>
            <div className="mt-5 space-y-3">
              <Opportunity
                title="Senior Product Designer"
                company="Kifiya Financial Technology"
                meta="Addis Ababa · Hybrid"
                tone="bg-[#d8ff3e]"
                initials="KF"
              />
              <Opportunity
                title="Frontend Engineer"
                company="PRAGMA Investment"
                meta="Remote · Full time"
                tone="bg-[#ffbc80]"
                initials="PI"
              />
              <Opportunity
                title="Marketing Lead"
                company="Dodai Manufacturing"
                meta="Addis Ababa · Full time"
                tone="bg-[#b8e5ff]"
                initials="DM"
              />
            </div>
            <Link
              href="/jobs"
              className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-white/15 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Explore all openings <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="absolute -bottom-10 -left-16 -rotate-3 rounded-2xl border border-primary/10 bg-white p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brandGreen/10 text-brandGreen">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <p className="text-lg font-black text-primary">3.2×</p>
                <p className="text-xs text-muted">more profile views</p>
              </div>
            </div>
          </div>
          <div className="absolute -right-8 top-24 rotate-6 rounded-2xl bg-white p-3 shadow-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <CheckCircle2 className="h-5 w-5 text-brandGreen" /> Verified
              employers
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Opportunity({
  title,
  company,
  meta,
  tone,
  initials,
}: {
  title: string;
  company: string;
  meta: string;
  tone: string;
  initials: string;
}) {
  return (
    <div className="rounded-[20px] bg-white p-4">
      <div className="flex gap-3">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black text-primary ${tone}`}
        >
          {initials}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-extrabold text-primary">
            {title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted">{company}</p>
          <p className="mt-2 text-[11px] font-semibold text-brandGreen">
            {meta}
          </p>
        </div>
      </div>
    </div>
  );
}
