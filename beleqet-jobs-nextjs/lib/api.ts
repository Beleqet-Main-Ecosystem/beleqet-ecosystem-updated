import axios from "axios";
import { z } from "zod";

const rawJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  location: z.string().nullish(),
  type: z.string().nullish(),
  featured: z.boolean().nullish(),
  tags: z.array(z.string()).nullish(),
  createdAt: z.string().nullish(),
  companyName: z.string().nullish(),
  company: z.object({ name: z.string().nullish() }).nullish(),
  category: z.object({ slug: z.string().nullish(), label: z.string().nullish() }).nullish(),
  categoryId: z.string().nullish(),
});

const jobsResponseSchema = z.object({
  items: z.array(rawJobSchema).default([]),
});

const rawCategorySchema = z.object({
  slug: z.string(),
  label: z.string(),
  icon: z.string().nullish(),
});

type RawJob = z.infer<typeof rawJobSchema>;
type RawCategory = z.infer<typeof rawCategorySchema>;

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  category: string;
  postedAgo: string;
  featured?: boolean;
  description?: string;
  tags?: string[];
};

export type Category = {
  id: string;
  label: string;
  icon: string;
  count?: string;
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  timeout: 10000,
});

const typeLabels: Record<string, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  CONTRACT: "Contract",
};

function relativeTime(iso?: string | null): string {
  if (!iso) return "Recently";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function toJob(raw: RawJob): Job {
  return {
    id: raw.id,
    title: raw.title,
    company: raw.company?.name ?? raw.companyName ?? "Confidential",
    location: raw.location ?? "",
    type: (raw.type && typeLabels[raw.type]) ?? raw.type ?? "",
    category: raw.category?.slug ?? raw.categoryId ?? "",
    postedAgo: relativeTime(raw.createdAt),
    featured: raw.featured ?? false,
    description: raw.description ?? "",
    tags: raw.tags ?? [],
  };
}

function toCategory(raw: RawCategory): Category {
  return { id: raw.slug, label: raw.label, icon: raw.icon ?? "briefcase" };
}

export async function fetchJobs(params?: Record<string, string | number>): Promise<Job[]> {
  try {
    const { data } = await api.get("/jobs", { params: { limit: 60, ...params } });
    return jobsResponseSchema.parse(data).items.map(toJob);
  } catch {
    return [];
  }
}

export async function fetchJob(id: string): Promise<Job | null> {
  try {
    const { data } = await api.get(`/jobs/${id}`);
    return toJob(rawJobSchema.parse(data));
  } catch {
    return null;
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data } = await api.get("/jobs/categories");
    return z.array(rawCategorySchema).parse(data).map(toCategory);
  } catch {
    return [];
  }
}
