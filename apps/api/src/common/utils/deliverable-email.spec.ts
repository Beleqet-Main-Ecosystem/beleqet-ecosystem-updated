import { isDeliverableEmail } from './deliverable-email';

describe('isDeliverableEmail', () => {
  it('accepts real addresses', () => {
    expect(isDeliverableEmail('someone@gmail.com')).toBe(true);
    expect(isDeliverableEmail('hr@company.et')).toBe(true);
  });

  it('skips the addresses the platform invents', () => {
    expect(isDeliverableEmail('telegram_123@beleqet.internal')).toBe(false);
    expect(isDeliverableEmail('scrubbed-ab12cd34@beleqet.internal')).toBe(false);
    expect(isDeliverableEmail('tma_456@TME.beleqet.local')).toBe(false);
  });

  it('skips empty or malformed values', () => {
    expect(isDeliverableEmail('')).toBe(false);
    expect(isDeliverableEmail(undefined)).toBe(false);
    expect(isDeliverableEmail('no-at-sign')).toBe(false);
  });
});
