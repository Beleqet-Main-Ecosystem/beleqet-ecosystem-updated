import axios from "axios";
import { z } from "zod";

const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  timeout: 10000,
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.string(),
});

export type AuthUser = z.infer<typeof userSchema>;

const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().nullish(),
  user: userSchema,
});

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "JOB_SEEKER" | "EMPLOYER" | "FREELANCER";
};

export type LoginInput = {
  email: string;
  password: string;
};

const TOKEN_KEY = "beleqet_token";
const REFRESH_KEY = "beleqet_refresh";
const USER_KEY = "beleqet_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return userSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persist(token: string, user: AuthUser, refreshToken?: string | null) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const { data } = await authApi.post("/auth/refresh", { refreshToken });
    const parsed = authResponseSchema.parse(data);
    persist(parsed.accessToken, parsed.user, parsed.refreshToken);
    return parsed.accessToken;
  } catch {
    clearAuth();
    return null;
  }
}

export async function authenticatedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response = await fetch(input, { ...init, headers });
  if (response.status !== 401) return response;

  const refreshedToken = await refreshAccessToken();
  if (!refreshedToken) return response;

  headers.set("Authorization", `Bearer ${refreshedToken}`);
  response = await fetch(input, { ...init, headers });
  return response;
}

function messageFrom(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[] }
      | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(", ");
    if (typeof msg === "string") return msg;
    if (error.code === "ECONNABORTED" || !error.response)
      return "Cannot reach the server. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  try {
    const { data } = await authApi.post("/auth/register", input);
    const parsed = authResponseSchema.parse(data);
    persist(parsed.accessToken, parsed.user, parsed.refreshToken);
    return parsed.user;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

export async function loginUser(input: LoginInput): Promise<AuthUser> {
  try {
    const { data } = await authApi.post("/auth/login", input);
    const parsed = authResponseSchema.parse(data);
    persist(parsed.accessToken, parsed.user, parsed.refreshToken);
    return parsed.user;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}
