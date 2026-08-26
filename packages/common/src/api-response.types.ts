/**
 * Generic API response wrapper types used across all endpoints.
 */

/** Standard paginated list response envelope. */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
  hasNextPage?: boolean;
}

/** Standard success message response. */
export interface MessageResponse {
  success: boolean;
  message: string;
}

/** Standard API error response. */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  traceId?: string;
  path?: string;
  timestamp?: string;
}
