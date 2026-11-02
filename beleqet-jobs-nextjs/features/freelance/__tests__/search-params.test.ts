import { gigSearchHref, parseGigSearch } from '../search-params';

describe('parseGigSearch', () => {
  it('reads the query and a known category', () => {
    expect(parseGigSearch({ q: ' logo ', category: 'writing' })).toEqual({ q: 'logo', category: 'writing' });
  });

  it('ignores an unknown category', () => {
    expect(parseGigSearch({ category: 'web-app-dev' }).category).toBe('');
  });

  it('uses the first value and limits the query length', () => {
    expect(parseGigSearch({ q: ['a'.repeat(200), 'b'] }).q).toHaveLength(100);
  });
});

describe('gigSearchHref', () => {
  it('leaves the URL clean with no search', () => {
    expect(gigSearchHref({ q: '', category: '' })).toBe('/freelance');
  });

  it('keeps the query when the category changes', () => {
    expect(gigSearchHref({ q: 'logo design', category: '' }, { category: 'graphic-design' })).toBe(
      '/freelance?q=logo+design&category=graphic-design',
    );
  });
});
