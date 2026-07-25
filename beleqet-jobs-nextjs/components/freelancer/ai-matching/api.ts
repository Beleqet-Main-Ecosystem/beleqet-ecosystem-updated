import { authenticatedFetch } from "../../../lib/auth";
import type { ProfileInsights } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function getProfileInsights(
  freelancerId: string,
): Promise<ProfileInsights | null> {
  try {
    const res = await authenticatedFetch(
      `${API_URL}/freelancers/${freelancerId}/ai-insights`,
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
