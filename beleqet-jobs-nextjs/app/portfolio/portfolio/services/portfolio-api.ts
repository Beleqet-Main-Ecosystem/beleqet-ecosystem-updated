import { authenticatedFetch } from "@/lib/auth";
import {
  PORTFOLIO_API_PATH,
  PORTFOLIO_DRAFT_KEY,
} from "../constants/storage";
import type { MasterProfileData } from "../types";
import {
  parsePortfolioData,
  touchPortfolio,
} from "../utils/portfolio-state";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/**
 * Loads portfolio data for authenticated users from the backend.
 * Returns null when no saved portfolio exists or the endpoint is unavailable.
 */
export async function fetchPortfolioFromApi(): Promise<MasterProfileData | null> {
  const response = await authenticatedFetch(`${API_URL}${PORTFOLIO_API_PATH}`);
  if (response.status === 404) return null;
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  const parsed = parsePortfolioData(body?.data ?? body);
  return parsed;
}

/**
 * Persists portfolio data for authenticated users.
 *
 * @param data - Normalized master profile payload.
 */
export async function savePortfolioToApi(
  data: MasterProfileData,
): Promise<boolean> {
  const payload = touchPortfolio(data);
  const response = await authenticatedFetch(`${API_URL}${PORTFOLIO_API_PATH}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: payload }),
  });
  return response.ok;
}

/**
 * Reads anonymous draft from localStorage.
 */
export function loadLocalPortfolioDraft(): MasterProfileData | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PORTFOLIO_DRAFT_KEY);
  if (!raw) return null;
  try {
    return parsePortfolioData(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Writes anonymous draft to localStorage.
 *
 * @param data - Master profile to persist locally.
 */
export function saveLocalPortfolioDraft(data: MasterProfileData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    PORTFOLIO_DRAFT_KEY,
    JSON.stringify(touchPortfolio(data)),
  );
}

/**
 * Exports portfolio JSON for download (client-side).
 *
 * @param data - Master profile data.
 */
export function exportPortfolioJson(data: MasterProfileData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
}
