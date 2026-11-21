import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  daysUntil,
  fileName,
  formatBudget,
  formatSalary,
  initials,
  jobGender,
  money,
  plainText,
  safeHttpUrl,
  shortName,
  timeAgo,
} from '../format';

describe('money and salaries', () => {
  it('shows whole birr, grouped', () => {
    expect(money(28000)).toBe('ETB 28,000');
    expect(money(1234.6, 'USD')).toBe('USD 1,235');
    expect(money(null)).toBe('ETB 0');
  });

  it('shows a salary range, a minimum, a maximum or nothing', () => {
    expect(formatSalary({ salaryMin: 28000, salaryMax: 35000 })).toBe('ETB 28,000–35,000');
    expect(formatSalary({ salaryMin: 28000 })).toBe('ETB 28,000+');
    expect(formatSalary({ salaryMax: 35000, currency: 'USD' }, 'up to')).toBe('USD up to 35,000');
    expect(formatSalary({})).toBeNull();
  });

  it('shows a budget once when both ends are the same', () => {
    expect(formatBudget({ budgetMin: 5000, budgetMax: 8000 })).toBe('ETB 5,000–8,000');
    expect(formatBudget({ budgetMin: 5000, budgetMax: 5000 })).toBe('ETB 5,000');
    expect(formatBudget({ budgetMin: 0, budgetMax: 7000 })).toBe('ETB 7,000');
  });
});

describe('dates', () => {
  const now = new Date('2026-11-21T12:00:00Z').getTime();
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('says how long ago, in the singular for one', () => {
    expect(timeAgo(new Date(now - 30 * 1000).toISOString(), 'en')).toBe('just now');
    expect(timeAgo(new Date(now - 5 * 60 * 1000).toISOString(), 'en')).toBe('5 min ago');
    expect(timeAgo(new Date(now - 86400 * 1000).toISOString(), 'en')).toBe('1 day ago');
    expect(timeAgo(new Date(now - 3 * 86400 * 1000).toISOString(), 'en')).toBe('3 days ago');
    expect(timeAgo(null, 'en')).toBe('');
  });

  it('counts the days left to a deadline, which lasts to the end of its day', () => {
    const today = new Date(now);
    const inDays = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n).toISOString();
    expect(daysUntil(inDays(0))).toBe(0);
    expect(daysUntil(inDays(3))).toBe(3);
    expect(daysUntil(inDays(-2))).toBe(-2);
    expect(daysUntil('not a date')).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
  });
});

describe('text from listings', () => {
  it('turns HTML descriptions into plain text and leaves plain text alone', () => {
    expect(plainText('<p>Hello &amp; welcome</p><ul><li>One</li><li>Two</li></ul>')).toBe('Hello & welcome\n\n• One\n• Two');
    expect(plainText('<script>alert(1)</script>Safe')).toBe('Safe');
    expect(plainText('Price &#8211; 5')).toBe('Price – 5');
    expect(plainText('Just text, 5 < 6')).toBe('Just text, 5 < 6');
    expect(plainText(null)).toBe('');
  });

  it('reads the gender the old site wrote in several ways', () => {
    expect(jobGender('Male')).toBe('MALE');
    expect(jobGender(' f ')).toBe('FEMALE');
    expect(jobGender('ሴት')).toBe('FEMALE');
    expect(jobGender('Both')).toBe('ANY');
    expect(jobGender('')).toBeNull();
  });

  it('opens only http and https links', () => {
    expect(safeHttpUrl('beleqetjobs.com/jobs')).toBe('https://beleqetjobs.com/jobs');
    expect(safeHttpUrl(' http://example.com ')).toBe('http://example.com');
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('tel:0911000000')).toBeNull();
    expect(safeHttpUrl('two words')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});

describe('names', () => {
  it('makes a two-letter monogram', () => {
    expect(initials('Abebe Kebede')).toBe('AK');
    expect(initials('Beleqet Jobs & Co.')).toBe('BJ');
    expect(initials('  ')).toBe('·');
  });

  it('shortens a person to first name and initial', () => {
    expect(shortName({ firstName: 'Abebe', lastName: 'Kebede' })).toBe('Abebe K.');
    expect(shortName({ firstName: 'Abebe' })).toBe('Abebe');
    expect(shortName(null)).toBe('');
  });

  it('takes the file name from a URL', () => {
    expect(fileName('https://cdn.example.com/uploads/My%20CV.pdf?token=1')).toBe('My CV.pdf');
    expect(fileName('https://cdn.example.com/uploads/')).toBe('https://cdn.example.com/uploads/');
  });
});
