import type {
  AuditLog,
  AuditLogDetail,
  AuditQueryParams,
  AuditStats,
  PaginatedResult,
} from "@/types/audit-trail";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function buildQueryString(params: AuditQueryParams): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";
  return (
    "?" +
    entries
      .map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      )
      .join("&")
  );
}

export async function fetchAuditLogs(
  params: AuditQueryParams,
  token: string,
  signal?: AbortSignal,
): Promise<PaginatedResult<AuditLog>> {
  const res = await fetch(
    `${BASE_URL}/audit-trail${buildQueryString(params)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    },
  );
  if (!res.ok) throw new Error(`Failed to fetch audit logs: ${res.status}`);
  return res.json() as Promise<PaginatedResult<AuditLog>>;
}

export async function fetchAuditLog(
  id: string,
  token: string,
  signal?: AbortSignal,
): Promise<AuditLogDetail> {
  const res = await fetch(`${BASE_URL}/audit-trail/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) throw new Error(`Failed to fetch audit log: ${res.status}`);
  return res.json() as Promise<AuditLogDetail>;
}

export async function fetchAuditStats(
  params: { fromDate?: string; toDate?: string },
  token: string,
  signal?: AbortSignal,
): Promise<AuditStats[]> {
  const qs = buildQueryString(params);
  const res = await fetch(`${BASE_URL}/audit-trail/stats${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) throw new Error(`Failed to fetch audit stats: ${res.status}`);
  return res.json() as Promise<AuditStats[]>;
}

export async function exportAuditCsv(
  params: AuditQueryParams,
  token: string,
): Promise<Blob> {
  const res = await fetch(
    `${BASE_URL}/audit-trail/export${buildQueryString(params)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok) throw new Error(`Failed to export audit CSV: ${res.status}`);
  return res.blob();
}
