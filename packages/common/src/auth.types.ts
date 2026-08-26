/**
 * Auth-related DTOs and response types.
 *
 * Field names match the backend Prisma `User` model and the JWT payload
 * returned by `POST /auth/login` and `GET /auth/me`.
 */

import { UserRole } from './enums';

// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  /** Defaults to JOB_SEEKER if omitted. */
  role?: UserRole;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface VerifyEmailDto {
  token: string;
}

// ── Response types ────────────────────────────────────────────────────────────

/**
 * Safe user profile fields.
 * Matches the Prisma `User` model columns returned by the API.
 *
 * NOTE: The backend `GET /auth/me` endpoint returns the raw JWT payload
 * which only contains { userId, email, role }.  The full profile is
 * available from `GET /users/profile`.
 */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string | null;
  phone?: string | null;
  headline?: string | null;
  bio?: string | null;
  location?: string | null;
  skills?: string[];
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  defaultResumeUrl?: string | null;
  isActive: boolean;
  /**
   * Canonical field name from the Prisma schema: `emailVerified`.
   * The mobile app previously used `isEmailVerified` — that was a mismatch.
   */
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * JWT payload shape returned by `GET /auth/me`.
 * This is the minimal token payload — not the full user profile.
 */
export interface JwtPayload {
  /** Maps to `User.id` in the database. */
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Response from `POST /auth/login` and `POST /auth/register`.
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken?: string | null;
  user: AuthUser;
}
