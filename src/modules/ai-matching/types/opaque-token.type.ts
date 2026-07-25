/**
 * Branded type for a session-scoped opaque token.
 * Replaces the real freelancer ID during GDPR sanitization
 * so the external LLM never sees the platform's internal identifier.
 */
export type OpaqueToken = string & { readonly __brand: 'OpaqueToken' };
