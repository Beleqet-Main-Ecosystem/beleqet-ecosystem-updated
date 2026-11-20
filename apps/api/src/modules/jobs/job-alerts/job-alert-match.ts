/** The parts of an alert and a job that decide whether the job is worth an email. */
export type AlertCriteria = {
  keywords: string[];
  location: string | null;
  jobType: string | null;
  minSalary: number | null;
};

export type AlertableJob = {
  title: string;
  description?: string | null;
  tags?: string[] | null;
  location: string;
  type: string;
  salaryMin: number | null;
  salaryMax: number | null;
};

/**
 * Every criterion the alert sets must hold: one of its keywords appears in the title, tags or
 * description; the location contains the alert's place; the type is the same; the pay reaches the
 * minimum. A job with no salary listed doesn't meet a minimum, so nobody is emailed a job that may
 * pay less than they asked for.
 */
export function alertMatches(alert: AlertCriteria, job: AlertableJob): boolean {
  if (alert.keywords.length) {
    const text =
      `${job.title} ${(job.tags ?? []).join(' ')} ${job.description ?? ''}`.toLowerCase();
    if (!alert.keywords.some((word) => word.trim() && text.includes(word.trim().toLowerCase())))
      return false;
  }
  if (alert.location && !job.location.toLowerCase().includes(alert.location.trim().toLowerCase()))
    return false;
  if (alert.jobType && alert.jobType !== job.type) return false;
  if (alert.minSalary) {
    const top = job.salaryMax ?? job.salaryMin;
    if (top === null || top < alert.minSalary) return false;
  }
  return true;
}
