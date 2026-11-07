import { escrowIdFromTxRef, escrowTxRef } from './escrow-tx-ref';

describe('escrow tx_ref', () => {
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';

  it('carries the escrow id and reads it back', () => {
    expect(escrowIdFromTxRef(escrowTxRef(id))).toBe(id);
  });

  it('stays within the characters and length Chapa accepts', () => {
    expect(escrowTxRef(id)).toMatch(/^[A-Za-z0-9-]{1,50}$/);
  });

  it('ignores references that are not escrow checkouts', () => {
    expect(escrowIdFromTxRef('CHAPA-0f8fad5b-d9cb-469f-a165-70867728950e')).toBeNull();
    expect(escrowIdFromTxRef('tx-1700000000-12')).toBeNull();
  });
});
