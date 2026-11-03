import { gigSearchHref, parseGigSearch } from '../search-params';

describe('parseGigSearch', () => {
  it('reads the query and a known category', () => {
    expect(parseGigSearch({ q: ' logo ', category: 'writing', sort: 'high' })).toEqual({ q: 'logo', category: 'writing', sort: 'high' });
    expect(parseGigSearch({ sort: 'cheapest' }).sort).toBe('default');
  });

  it('uses the first value and limits the query length', () => {
    expect(parseGigSearch({ q: ['a'.repeat(200), 'b'] }).q).toHaveLength(100);
  });
});

describe('gigSearchHref', () => {
  it('leaves the URL clean with no search', () => {
    expect(gigSearchHref({ q: '', category: '', sort: 'default' })).toBe('/freelance');
  });

  it('keeps a budget sort in the URL', () => {
    expect(gigSearchHref({ q: '', category: '', sort: 'high' })).toBe('/freelance?sort=high');
  });

  it('keeps the query when the category changes', () => {
    expect(gigSearchHref({ q: 'logo design', category: '', sort: 'default' }, { category: 'graphic-design' })).toBe(
      '/freelance?q=logo+design&category=graphic-design',
    );
  });
});
