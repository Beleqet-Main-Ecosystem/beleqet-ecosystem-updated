/**
 * Client feedback shape stored on User.clientFeedback JSON field.
 */
export interface ClientFeedbackEntry {
  rating?: number;
  comment?: string;
}

export type ClientFeedback = ClientFeedbackEntry[] | null | undefined;

/**
 * Normalize Prisma JSON value to a typed feedback array.
 */
export function parseClientFeedback(value: unknown): ClientFeedbackEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is ClientFeedbackEntry => typeof entry === 'object' && entry !== null,
  );
}
