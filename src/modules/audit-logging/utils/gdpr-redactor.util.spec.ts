import { redactAuditPayload, redactPayload, redactText } from './gdpr-redactor.util';

describe('gdpr-redactor.util', () => {
  describe('redactText', () => {
    it('redacts email addresses', () => {
      expect(redactText('Contact user@beleqet.com now')).toContain('[REDACTED EMAIL]');
      expect(redactText('Contact user@beleqet.com now')).not.toContain('user@beleqet.com');
    });

    it('redacts phone-like numbers', () => {
      const result = redactText('Call +251911234567 please');
      expect(result).toContain('[REDACTED PHONE]');
    });

    it('returns empty input unchanged', () => {
      expect(redactText('')).toBe('');
    });
  });

  describe('redactPayload', () => {
    it('redacts sensitive keys case-insensitively', () => {
      const result = redactPayload({
        password: 'secret123',
        accessToken: 'tok',
        nested: { refresh_token: 'r' },
      }) as Record<string, unknown>;

      expect(result.password).toBe('[REDACTED]');
      expect(result.accessToken).toBe('[REDACTED]');
      expect((result.nested as Record<string, unknown>).refresh_token).toBe('[REDACTED]');
    });

    it('redacts emails inside nested strings', () => {
      const result = redactPayload({ note: 'mail alice@example.com' }) as Record<string, unknown>;
      expect(result.note).toBe('mail [REDACTED EMAIL]');
    });

    it('preserves numbers and booleans', () => {
      const result = redactPayload({ amount: 100, ok: true }) as Record<string, unknown>;
      expect(result.amount).toBe(100);
      expect(result.ok).toBe(true);
    });
  });

  describe('redactAuditPayload', () => {
    it('returns empty object for undefined', () => {
      expect(redactAuditPayload(undefined)).toEqual({});
    });
  });
});
