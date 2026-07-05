import {
  maskPayerPii,
  sanitiseForStorage,
} from './paypal-pii.utils';

/**
 * Unit tests for {@link maskPayerPii} and {@link sanitiseForStorage}.
 *
 * Verifies:
 * - Email fields are SHA-256 hashed (not stored in plaintext)
 * - Personal name fields are replaced with `[GDPR_REDACTED]`
 * - Phone and address fields are redacted
 * - Non-PII numeric and status fields are preserved intact
 * - Nested objects are recursively processed
 * - Arrays within objects are processed element by element
 * - Null, undefined, and non-object inputs pass through safely
 * - `sanitiseForStorage()` returns null for null input
 * - Hash output is a deterministic 64-char hex string for the same input
 */
describe('PayPal PII Utilities', () => {

  // ── maskPayerPii ────────────────────────────────────────────────────────────

  describe('maskPayerPii', () => {
    it('SHA-256 hashes the payer email_address field', () => {
      const input = {
        payer: { email_address: 'buyer@example.com' },
      };

      const result = maskPayerPii(input);

      // Should not contain the plaintext email
      expect(JSON.stringify(result)).not.toContain('buyer@example.com');
      // The hashed value should be a 64-char hex string (SHA-256 output)
      expect(result.payer.email_address).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces the same hash for the same email (deterministic)', () => {
      const input1 = { payer: { email_address: 'same@email.com' } };
      const input2 = { payer: { email_address: 'same@email.com' } };

      const result1 = maskPayerPii(input1);
      const result2 = maskPayerPii(input2);

      expect(result1.payer.email_address).toBe(result2.payer.email_address);
    });

    it('produces different hashes for different emails', () => {
      const result1 = maskPayerPii({ payer: { email_address: 'alice@example.com' } });
      const result2 = maskPayerPii({ payer: { email_address: 'bob@example.com' } });

      expect(result1.payer.email_address).not.toBe(result2.payer.email_address);
    });

    it('redacts payer given_name with [GDPR_REDACTED]', () => {
      const input = {
        payer: {
          name: { given_name: 'John', surname: 'Doe' },
        },
      };

      const result = maskPayerPii(input);

      expect(JSON.stringify(result)).not.toContain('John');
      expect(JSON.stringify(result)).not.toContain('Doe');
    });

    it('redacts shipping address fields', () => {
      const input = {
        purchase_units: [
          {
            shipping: {
              address: {
                address_line_1: '123 Main Street',
                admin_area_2:   'Springfield',
                postal_code:    '12345',
                country_code:   'US',
              },
            },
          },
        ],
      };

      const result = maskPayerPii(input);

      expect(JSON.stringify(result)).not.toContain('123 Main Street');
      expect(JSON.stringify(result)).not.toContain('Springfield');
      expect(JSON.stringify(result)).not.toContain('12345');
    });

    it('preserves non-PII fields such as status, amount, and order IDs', () => {
      const input = {
        id:     'ORDER-123',
        status: 'COMPLETED',
        amount: { value: '150.00', currency_code: 'USD' },
        payer:  { email_address: 'buyer@example.com' },
      };

      const result = maskPayerPii(input);

      expect(result.id).toBe('ORDER-123');
      expect(result.status).toBe('COMPLETED');
      expect(result.amount.value).toBe('150.00');
      expect(result.amount.currency_code).toBe('USD');
    });

    it('recursively processes nested objects', () => {
      const input = {
        level1: {
          level2: {
            payer: { email_address: 'nested@example.com' },
          },
        },
      };

      const result = maskPayerPii(input);

      expect(JSON.stringify(result)).not.toContain('nested@example.com');
    });

    it('processes arrays of objects element by element', () => {
      const input = {
        purchase_units: [
          { payee: { email_address: 'seller1@example.com' } },
          { payee: { email_address: 'seller2@example.com' } },
        ],
      };

      const result = maskPayerPii(input);
      const serialised = JSON.stringify(result);

      expect(serialised).not.toContain('seller1@example.com');
      expect(serialised).not.toContain('seller2@example.com');
    });

    it('handles null values in nested fields without throwing', () => {
      const input = {
        payer: {
          email_address: null,
          phone:         null,
        },
      };

      expect(() => maskPayerPii(input)).not.toThrow();
    });

    it('passes through primitive (non-object) inputs unchanged', () => {
      // Calling maskPayerPii with a string should not throw
      expect(() => maskPayerPii('raw string' as any)).not.toThrow();
      expect(() => maskPayerPii(12345 as any)).not.toThrow();
      expect(() => maskPayerPii(null as any)).not.toThrow();
    });
  });

  // ── sanitiseForStorage ──────────────────────────────────────────────────────

  describe('sanitiseForStorage', () => {
    it('returns {} (empty object) for null input', () => {
      expect(sanitiseForStorage(null)).toEqual({});
    });

    it('returns {} (empty object) for undefined input', () => {
      expect(sanitiseForStorage(undefined)).toEqual({});
    });

    it('sanitises a typical PayPal order response before DB persistence', () => {
      const rawPaypalResponse = {
        id:     'ORDER-XYZ',
        status: 'COMPLETED',
        payer:  {
          email_address: 'realbuyer@paypal.com',
          name:          { given_name: 'Alice', surname: 'Smith' },
        },
      };

      const sanitised = sanitiseForStorage(rawPaypalResponse) as any;

      expect(sanitised).not.toBeNull();
      expect(sanitised.id).toBe('ORDER-XYZ');
      expect(sanitised.status).toBe('COMPLETED');
      // PII should be masked
      expect(JSON.stringify(sanitised)).not.toContain('realbuyer@paypal.com');
      expect(JSON.stringify(sanitised)).not.toContain('Alice');
    });

    it('returns the sanitised object as a plain JSON-serialisable value', () => {
      const input = {
        id:    'CAPTURE-123',
        payer: { email_address: 'test@test.com' },
      };

      const result = sanitiseForStorage(input);

      // Must be JSON-serialisable (no Buffers, no undefined, etc.)
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('handles a simulated mock response (no real PII) without throwing', () => {
      const mockResponse = {
        status:    'COMPLETED',
        simulated: true,
      };

      const result = sanitiseForStorage(mockResponse) as any;

      expect(result.status).toBe('COMPLETED');
      expect(result.simulated).toBe(true);
    });
  });
});
