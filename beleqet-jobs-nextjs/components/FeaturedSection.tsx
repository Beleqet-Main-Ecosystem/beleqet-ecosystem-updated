import FeaturedJobs from "./FeaturedJobs";
import { fetchJobs } from "@/lib/api";

export default async function FeaturedSection() {
  const jobs = await fetchJobs();
  const featured = jobs.filter((job) => job.featured);
  return <FeaturedJobs jobs={(featured.length ? featured : jobs).slice(0, 5)} />;
}
