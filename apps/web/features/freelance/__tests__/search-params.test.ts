import { gigApiFilters, gigSearchHref, parseGigSearch } from '../search-params';

describe('parseGigSearch', () => {
  it('reads the query and a known category', () => {
    expect(parseGigSearch({ q: ' logo ', category: 'writing', sort: 'high' })).toEqual({ q: 'logo', category: 'writing', sort: 'high', pricing: '', level: '', budget: '' });
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

describe('project filters', () => {
  it('reads pricing, budget and experience, keeping only the offered values', () => {
    expect(parseGigSearch({ pricing: 'hourly', budget: '5k-20k', level: 'expert' })).toMatchObject({ pricing: 'HOURLY', budget: '5k-20k', level: 'Expert' });
    expect(parseGigSearch({ pricing: 'free', budget: 'lots', level: 'guru' })).toMatchObject({ pricing: '', budget: '', level: '' });
  });

  it('writes them to the link and turns them into the API filters', () => {
    const search = parseGigSearch({ pricing: 'FIXED', budget: '20k-50k', level: 'Entry' });
    expect(gigSearchHref(search)).toBe('/freelance?pricing=FIXED&budget=20k-50k&level=Entry');
    expect(gigApiFilters(search)).toEqual({ pricingType: 'FIXED', experienceLevel: 'Entry', budgetMin: 20000, budgetMax: 50000 });
    expect(gigApiFilters(parseGigSearch({ budget: 'under5k' }))).toMatchObject({ budgetMin: undefined, budgetMax: 5000 });
  });
});
