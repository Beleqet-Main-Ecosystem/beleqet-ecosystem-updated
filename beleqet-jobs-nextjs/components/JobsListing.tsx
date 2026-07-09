"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, MapPin, SlidersHorizontal, X } from "lucide-react";
import type { Job, Category } from "@/lib/api";
import JobCard from "@/components/JobCard";

const jobTypes = ["Full Time", "Part Time", "Remote", "Hybrid", "Contract"];

export default function JobsListing({
  initialJobs,
  categories,
}: {
  initialJobs: Job[];
  categories: Category[];
}) {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [location, setLocation] = useState(searchParams.get("loc") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [type, setType] = useState<string>("");

  const filtered = useMemo(() => {
    return initialJobs.filter((job) => {
      const matchesQuery =
        !query ||
        job.title.toLowerCase().includes(query.toLowerCase()) ||
        job.company.toLowerCase().includes(query.toLowerCase());
      const matchesLocation = !location || job.location.toLowerCase().includes(location.toLowerCase());
      const matchesCategory = !category || job.category === category;
      const matchesType = !type || job.type === type;
      return matchesQuery && matchesLocation && matchesCategory && matchesType;
    });
  }, [initialJobs, query, location, category, type]);

  const categoryLabel = categories.find((c) => c.id === category)?.label;
  const hasFilters = Boolean(query || location || category || type);

  function clearAll() {
    setQuery("");
    setLocation("");
    setCategory("");
    setType("");
  }

  return (
    <div className="container-page py-10">
      <div className="mb-6">
        <h1 className="text-pageH1">Search verified jobs from trusted employers.</h1>
        <p className="text-muted text-sm mt-2">
          <span className="font-semibold text-ink">{filtered.length}</span> job{filtered.length === 1 ? "" : "s"} found
        </p>
      </div>

      <form
        onSubmit={(e) => e.preventDefault()}
        className="bg-white rounded-2xl border border-border p-2 flex flex-col sm:flex-row gap-2 mb-4 shadow-card"
      >
        <div className="flex items-center flex-1 gap-2 px-3 py-2.5 rounded-xl">
          <Search className="h-4 w-4 text-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Job title, keyword or company"
            className="w-full text-sm text-ink placeholder:text-muted outline-none"
          />
        </div>
        <div className="hidden sm:block w-px bg-border my-1" />
        <div className="flex items-center flex-1 gap-2 px-3 py-2.5 rounded-xl">
          <MapPin className="h-4 w-4 text-muted shrink-0" />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location e.g. Addis Ababa"
            className="w-full text-sm text-ink placeholder:text-muted outline-none"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-brandGreen px-6 py-3 text-sm font-semibold text-white hover:bg-darkGreen transition-colors"
        >
          <Search className="h-4 w-4" /> Search
        </button>
      </form>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {query && <FilterChip label={`“${query}”`} onClear={() => setQuery("")} />}
          {location && <FilterChip label={location} onClear={() => setLocation("")} />}
          {category && <FilterChip label={categoryLabel ?? category} onClear={() => setCategory("")} />}
          {type && <FilterChip label={type} onClear={() => setType("")} />}
          <button onClick={clearAll} className="text-xs font-semibold text-brandGreen hover:underline ml-1">
            Clear all
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink mb-4">
              <SlidersHorizontal className="h-4 w-4" /> Category
            </h3>
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              <FilterButton active={category === ""} onClick={() => setCategory("")}>
                All Categories
              </FilterButton>
              {categories.map((cat) => (
                <FilterButton key={cat.id} active={category === cat.id} onClick={() => setCategory(cat.id)}>
                  <span className="flex w-full items-center justify-between">
                    <span>{cat.label}</span>
                    {cat.count ? <span className="text-xs text-muted">{cat.count}</span> : null}
                  </span>
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">Job Type</h3>
            <div className="space-y-1">
              <FilterButton active={type === ""} onClick={() => setType("")}>
                All Types
              </FilterButton>
              {jobTypes.map((t) => (
                <FilterButton key={t} active={type === t} onClick={() => setType(t)}>
                  {t}
                </FilterButton>
              ))}
            </div>
          </div>
        </aside>

        <div>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-white p-12 text-center">
              <p className="text-ink font-semibold">No jobs match your filters</p>
              <p className="text-sm text-muted mt-1">Try adjusting your search or clearing filters.</p>
              {hasFilters && (
                <button
                  onClick={clearAll}
                  className="mt-4 inline-flex rounded-full border border-border px-5 py-2 text-sm font-semibold text-ink hover:bg-pageBg transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((job) => (
                <JobCard key={job.id} job={job} variant="light" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
        active ? "bg-brandGreen/10 text-brandGreen font-semibold" : "text-muted hover:bg-pageBg"
      }`}
    >
      {children}
    </button>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brandGreen/10 text-brandGreen text-xs font-medium pl-3 pr-2 py-1.5">
      {label}
      <button onClick={onClear} aria-label={`Remove ${label} filter`} className="hover:text-darkGreen">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
