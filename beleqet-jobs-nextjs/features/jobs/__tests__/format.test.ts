import { daysUntil, safeEmail, safeHttpUrl } from '../format';

describe('safeHttpUrl', () => {
  it('keeps http(s) links and adds a scheme to bare domains', () => {
    expect(safeHttpUrl('https://jobs.example.com/apply?id=1')).toBe('https://jobs.example.com/apply?id=1');
    expect(safeHttpUrl('example.com')).toBe('https://example.com/');
  });

  it('drops script and data links', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl(' JaVaScRiPt:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeHttpUrl('')).toBeNull();
  });
});

describe('safeEmail', () => {
  it('accepts plain addresses and rejects header injection', () => {
    expect(safeEmail(' hr@example.com ')).toBe('hr@example.com');
    expect(safeEmail('hr@example.com?body=hi')).toBeNull();
    expect(safeEmail('hr@example.com&cc=boss@example.com')).toBeNull();
    expect(safeEmail('not an email')).toBeNull();
  });
});

describe('daysUntil', () => {
  it('counts the closing day as open and past dates as negative', () => {
    const today = new Date();
    expect(daysUntil(today.toISOString())).toBe(0);
    const lastYear = new Date(today.getFullYear() - 1, 0, 1).toISOString();
    expect(daysUntil(lastYear)).toBeLessThan(0);
    expect(daysUntil(null)).toBeNull();
  });
});
