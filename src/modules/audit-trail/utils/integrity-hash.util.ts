import { createHash } from 'crypto';

/** Fields included in the SHA-256 integrity hash computation. */
export interface HashableEntry {
  /** UUID assigned to the record. */
  id: string;
  /** UUID of the user who performed the action, or null for system actions. */
  actorId?: string | null;
  /** The action label. */
  action: string;
  /** Domain entity class affected (e.g. `'User'`, `'Contract'`). */
  entityType: string;
  /** Primary key of the affected entity instance. */
  entityId?: string | null;
  /** Timestamp at which the record was created. */
  createdAt: Date;
  /** Client IP address. */
  ipAddress?: string | null;
  /** Arbitrary structured context captured at write time. */
  metadata?: Record<string, unknown> | null;
}

/**
 * Computes a deterministic SHA-256 hash over a fixed set of audit log fields.
 *
 * Fields are serialised in a fixed order with null-coalescing applied to
 * optional values, ensuring byte-for-byte reproducibility.
 *
 * @param entry - The fields to include in the hash.
 * @returns A lowercase 64-character hex digest.
 */
export function computeIntegrityHash(entry: HashableEntry): string {
  const canonical = JSON.stringify({
    id: entry.id,
    actorId: entry.actorId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    createdAt: entry.createdAt.toISOString(),
    ipAddress: entry.ipAddress ?? null,
    metadata: entry.metadata ?? {},
  });
  return createHash('sha256').update(canonical).digest('hex');
}
