import { primaryFrontendUrl } from './frontend-url';

describe('primaryFrontendUrl', () => {
  it('uses the first address of a comma-separated list', () => {
    expect(
      primaryFrontendUrl(
        'https://beleqetjobs.com, https://www.beleqetjobs.com,http://localhost:3000',
      ),
    ).toBe('https://beleqetjobs.com');
  });

  it('leaves a single address as it is, without a trailing slash', () => {
    expect(primaryFrontendUrl('https://beleqetjobs.com/')).toBe('https://beleqetjobs.com');
  });

  it('falls back when it is unset or empty', () => {
    expect(primaryFrontendUrl(undefined)).toBe('http://localhost:4001');
    expect(primaryFrontendUrl('')).toBe('http://localhost:4001');
  });
});
