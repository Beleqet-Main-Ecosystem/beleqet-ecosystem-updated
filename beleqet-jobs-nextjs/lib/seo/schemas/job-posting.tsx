import React from "react";
import { getSeoConfig } from "../config";

/**
 * Shape accepted by `JobPostingSchema`.  Only the fields that are safe for
 * public indexing — **no PII** (GDPR-safe).
 */
export interface JobPostingData {
  id: string;
  title: string;
  description: string;
  datePosted: string;
  company: string;
  location: string;
  employmentType: string;
}

/**
 * `<script type="application/ld+json">` fragment describing a single job
 * posting.  Renders the `JobPosting` schema.org type so that Google can show
 * rich job results in SERPs.
 *
 * **GDPR note**: This component **never** receives or renders personal data
 * (applicant names, emails, phone numbers).  It only uses job-level metadata.
 *
 * @see https://schema.org/JobPosting
 * @see https://developers.google.com/search/docs/appearance/structured-data/job-posting
 */
export function JobPostingSchema({
  job,
}: {
  job: JobPostingData;
}): React.ReactElement {
  const { siteUrl, organization } = getSeoConfig();

  const json = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.datePosted,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
      sameAs: organization.url,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: job.location,
        addressCountry: "ET",
      },
    },
    employmentType: normalizeEmploymentType(job.employmentType),
    directApply: true,
    url: `${siteUrl}/jobs/${job.id}`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

/**
 * Map the app's internal type labels to schema.org / Google-recognised values.
 */
function normalizeEmploymentType(raw: string): string {
  const map: Record<string, string> = {
    "FULL_TIME": "FULL_TIME",
    "PART_TIME": "PART_TIME",
    "REMOTE": "REMOTE",
    "HYBRID": "HYBRID",
    "CONTRACT": "CONTRACTOR",
    "Full Time": "FULL_TIME",
    "Part Time": "PART_TIME",
    "Contract": "CONTRACTOR",
  };
  return map[raw] ?? "FULL_TIME";
}
