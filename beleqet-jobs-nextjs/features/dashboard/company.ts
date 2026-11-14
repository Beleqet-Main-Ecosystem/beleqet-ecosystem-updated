import { safeHttpUrl } from '@/features/jobs/format';

/** The employer's company, as GET /users/company returns it. */
export type Company = {
  name: string;
  industry?: string | null;
  location?: string | null;
  size?: string | null;
  foundedYear?: number | null;
  description?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  facebookUrl?: string | null;
  twitterUrl?: string | null;
  benefits?: string[] | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  verified?: boolean;
  verificationStatus?: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationNote?: string | null;
};

export type CompanyStatus = NonNullable<Company['verificationStatus']>;

export const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–500', '500+'];

/** The company's web links, in the order they are shown, with only safe http(s) addresses kept. */
export const COMPANY_LINKS = [
  { key: 'website', label: 'emp.websiteLabel' },
  { key: 'linkedinUrl', label: 'emp.linkedin' },
  { key: 'facebookUrl', label: 'emp.facebook' },
  { key: 'twitterUrl', label: 'emp.twitter' },
] as const;

export function companyStatus(company: Company): CompanyStatus {
  return company.verified ? 'VERIFIED' : company.verificationStatus ?? 'NONE';
}

export function companyLink(company: Company, key: (typeof COMPANY_LINKS)[number]['key']): string | null {
  return safeHttpUrl(company[key]);
}

/** A link shown without its scheme or trailing slash, e.g. linkedin.com/company/beleqet. */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}
