import { Suspense } from "react";
import JobsListing from "@/components/JobsListing";
import { fetchCategories, fetchJobs } from "@/lib/api";

export const revalidate = 60;

export const metadata = {
  title: "Find Jobs | Beleqet Jobs",
};

export default async function JobsPage() {
  const [jobs, categories] = await Promise.all([fetchJobs(), fetchCategories()]);

  return (
    <Suspense fallback={<div className="container-page py-20 text-center text-muted">Loading jobs…</div>}>
      <JobsListing initialJobs={jobs} categories={categories} />
    </Suspense>
  );
}
