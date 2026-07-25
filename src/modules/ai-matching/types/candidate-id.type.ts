/**
 * Branded type for a freelancer or candidate identifier.
 * Guarantees at the type level that a plain string cannot be
 * used where a candidate ID is expected.
 */
export type CandidateId = string & { readonly __brand: 'CandidateId' };
