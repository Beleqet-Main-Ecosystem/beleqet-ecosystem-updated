/**
 * Chapa tx_ref for one attempt to fund an escrow. Chapa refuses a tx_ref it has seen, so every
 * new checkout needs a fresh one; carrying the escrow id lets a callback for an older, abandoned
 * checkout still find its escrow.
 */
export function escrowTxRef(escrowId: string): string {
  return `E-${escrowId}-${Date.now().toString(36)}`;
}

/** The escrow id inside an {@link escrowTxRef}, or null for any other reference. */
export function escrowIdFromTxRef(txRef: string): string | null {
  const match = /^E-([0-9a-f-]{36})-[0-9a-z]+$/i.exec(txRef);
  return match ? match[1] : null;
}
