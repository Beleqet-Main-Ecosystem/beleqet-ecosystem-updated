import { authenticatedFetch } from "../../../lib/auth";
import type { MatchResponse } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface MatchError {
  readonly status: number;
  readonly message: string;
}

export async function getJobMatches(jobId: string): Promise<{
  data: MatchResponse | null;
  error: MatchError | null;
}> {
  try {
    const res = await authenticatedFetch(`${API_URL}/ai-matching/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.message) message = body.message;
      } catch { /* ignore parse error */ }
      return { data: null, error: { status: res.status, message } };
    }
    const data = await res.json();
    return { data, error: null };
  } catch {
    return {
      data: null,
      error: { status: 0, message: "Cannot reach the server. Check that the backend is running." },
    };
  }
}
