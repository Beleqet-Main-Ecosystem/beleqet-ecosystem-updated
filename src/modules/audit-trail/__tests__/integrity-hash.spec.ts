import { computeIntegrityHash } from '../utils/integrity-hash.util';

describe('computeIntegrityHash', () => {
  const base = {
    id: 'test-id-1',
    actorId: 'actor-1',
    action: 'AUTH_LOGIN',
    entityType: 'User',
    entityId: 'entity-1',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    ipAddress: '127.0.0.1',
    metadata: { foo: 'bar' },
  };

  it('produces a 64-character hex string', () => {
    const hash = computeIntegrityHash(base);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic — same input produces same hash', () => {
    expect(computeIntegrityHash(base)).toBe(computeIntegrityHash({ ...base }));
  });

  it('changes when id changes', () => {
    expect(computeIntegrityHash(base)).not.toBe(
      computeIntegrityHash({ ...base, id: 'different-id' }),
    );
  });

  it('changes when action changes', () => {
    expect(computeIntegrityHash(base)).not.toBe(
      computeIntegrityHash({ ...base, action: 'AUTH_LOGOUT' }),
    );
  });

  it('changes when metadata changes', () => {
    expect(computeIntegrityHash(base)).not.toBe(
      computeIntegrityHash({ ...base, metadata: { foo: 'baz' } }),
    );
  });

  it('changes when createdAt changes', () => {
    expect(computeIntegrityHash(base)).not.toBe(
      computeIntegrityHash({ ...base, createdAt: new Date('2025-06-01T00:00:00.000Z') }),
    );
  });

  it('treats null and undefined actorId the same way', () => {
    const withNull = computeIntegrityHash({ ...base, actorId: null });
    const withUndefined = computeIntegrityHash({ ...base, actorId: undefined });
    expect(withNull).toBe(withUndefined);
  });

  it('treats missing metadata as empty object', () => {
    const withUndefined = computeIntegrityHash({ ...base, metadata: undefined });
    const withEmpty = computeIntegrityHash({ ...base, metadata: {} });
    expect(withUndefined).toBe(withEmpty);
  });
});
