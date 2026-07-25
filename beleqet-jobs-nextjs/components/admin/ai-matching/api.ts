import { authenticatedFetch } from "../../../lib/auth";
import type { AiMatchingMetrics, GdprAuditEntry } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface AdminApiError {
  readonly status: number;
  readonly message: string;
}

async function readError(
  res: Response,
  fallback: string,
): Promise<AdminApiError> {
  let message = fallback;
  try {
    const body = await res.json();
    if (body?.message) message = body.message;
  } catch {
    // body wasn't JSON; keep fallback
  }
  return { status: res.status, message };
}

export async function getAiMatchingMetrics(): Promise<{
  data: AiMatchingMetrics | null;
  error: AdminApiError | null;
}> {
  try {
    const res = await authenticatedFetch(`${API_URL}/admin/ai-matching/metrics`);
    if (!res.ok) {
      return {
        data: null,
        error: await readError(res, `Request failed (${res.status})`),
      };
    }
    return { data: (await res.json()) as AiMatchingMetrics, error: null };
  } catch {
    return {
      data: null,
      error: {
        status: 0,
        message: "Cannot reach the server. Check that the backend is running.",
      },
    };
  }
}

export async function getGdprAuditLog(): Promise<{
  data: readonly GdprAuditEntry[] | null;
  error: AdminApiError | null;
}> {
  try {
    const res = await authenticatedFetch(
      `${API_URL}/admin/ai-matching/gdpr-audit-log`,
    );
    if (!res.ok) {
      return {
        data: null,
        error: await readError(res, `Request failed (${res.status})`),
      };
    }
    return { data: (await res.json()) as readonly GdprAuditEntry[], error: null };
  } catch {
    return {
      data: null,
      error: {
        status: 0,
        message: "Cannot reach the server. Check that the backend is running.",
      },
    };
  }
}
