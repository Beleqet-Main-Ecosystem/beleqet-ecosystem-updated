import { sanitizePayload } from './sanitize-payload.util';

describe('sanitizePayload', () => {
  it('redacts a top-level sensitive key', () => {
    const result = sanitizePayload({ password: 'hunter2' });
    expect(result.password).toBe('[REDACTED]');
  });

  it('redacts a sensitive key inside a nested object (existing behavior)', () => {
    const result = sanitizePayload({ before: { token: 'abc123' }, after: {} });
    expect((result.before as Record<string, unknown>).token).toBe('[REDACTED]');
  });

  it('sanitizes sensitive keys inside an array of objects (bug fix)', () => {
    const result = sanitizePayload({
      users: [{ password: 'secret' }, { password: 'secret2' }],
    });
    const users = result.users as Array<Record<string, unknown>>;
    expect(users[0].password).toBe('[REDACTED]');
    expect(users[1].password).toBe('[REDACTED]');
  });

  it('sanitizes nested objects inside array elements, not just direct sensitive keys', () => {
    const result = sanitizePayload({
      changes: [{ before: { secret: 'shh' }, after: {} }],
    });
    const changes = result.changes as Array<Record<string, unknown>>;
    expect((changes[0].before as Record<string, unknown>).secret).toBe('[REDACTED]');
  });

  it('preserves Date instances instead of collapsing them to {} (bug fix)', () => {
    const now = new Date('2026-01-15T10:00:00.000Z');
    const result = sanitizePayload({ createdAt: now });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect((result.createdAt as Date).toISOString()).toBe('2026-01-15T10:00:00.000Z');
  });

  it('preserves a Date nested inside an array element', () => {
    const now = new Date('2026-02-20T08:30:00.000Z');
    const result = sanitizePayload({ events: [{ occurredAt: now }] });
    const events = result.events as Array<Record<string, unknown>>;
    expect(events[0].occurredAt).toBeInstanceOf(Date);
  });

  it('passes null through unchanged', () => {
    const result = sanitizePayload({ deletedAt: null });
    expect(result.deletedAt).toBeNull();
  });

  it('leaves non-sensitive primitive values untouched', () => {
    const result = sanitizePayload({ count: 5, active: true });
    expect(result.count).toBe(5);
    expect(result.active).toBe(true);
  });
});
