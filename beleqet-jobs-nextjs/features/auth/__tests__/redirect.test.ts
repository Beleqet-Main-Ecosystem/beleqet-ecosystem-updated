import { homeFor, safeNextPath } from '../redirect';

describe('safeNextPath', () => {
  it('allows same-site paths with queries', () => {
    expect(safeNextPath('/jobs/123')).toBe('/jobs/123');
    expect(safeNextPath(encodeURIComponent('/jobs?q=nurse&page=2'))).toBe('/jobs?q=nurse&page=2');
  });

  it('rejects other sites, including protocol-relative tricks', () => {
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('/\\evil.example')).toBeNull();
    expect(safeNextPath(encodeURIComponent('//evil.example'))).toBeNull();
    expect(safeNextPath('javascript:alert(1)')).toBeNull();
    expect(safeNextPath('/jobs\n//evil.example')).toBeNull();
  });

  it('ignores empty or malformed values', () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath('')).toBeNull();
    expect(safeNextPath('%E0%A4%A')).toBeNull();
  });
});

describe('homeFor', () => {
  it('sends each role to its own home', () => {
    expect(homeFor({ role: 'EMPLOYER' } as never)).toBe('/employer');
    expect(homeFor({ role: 'ADMIN' } as never)).toBe('/admin');
    expect(homeFor({ role: 'JOB_SEEKER' } as never)).toBe('/dashboard');
    expect(homeFor({ role: 'FREELANCER' } as never)).toBe('/dashboard');
  });
});
