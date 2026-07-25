/**
 * Branded type for a matching session identifier.
 * Used to correlate all stages of a single matching pipeline execution.
 */
export type SessionId = string & { readonly __brand: 'SessionId' };
