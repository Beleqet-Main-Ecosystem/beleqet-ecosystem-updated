import { jobSearchHref, pageWindow, parseJobSearch } from '../search-params';

describe('parseJobSearch', () => {
  it('reads every supported parameter', () => {
    expect(parseJobSearch({ q: ' accountant ', loc: 'Addis Ababa', category: 'health-care', type: 'remote', page: '3' })).toEqual({
      q: 'accountant',
      loc: 'Addis Ababa',
      category: 'health-care',
      type: 'REMOTE',
      page: 3,
    });
  });

  it('drops values the API would reject', () => {
    const search = parseJobSearch({ type: 'INTERNSHIP', page: '-2' });
    expect(search.type).toBe('');
    expect(search.page).toBe(1);
    expect(parseJobSearch({ page: 'abc' }).page).toBe(1);
  });

  it('takes the first value of a repeated parameter', () => {
    expect(parseJobSearch({ q: ['nurse', 'driver'] }).q).toBe('nurse');
  });
});

describe('jobSearchHref', () => {
  const base = parseJobSearch({ q: 'sales', loc: 'Adama', page: '4' });

  it('keeps the search and changes only what is asked', () => {
    expect(jobSearchHref(base, { page: 5 })).toBe('/jobs?q=sales&loc=Adama&page=5');
  });

  it('leaves out empty values and page 1', () => {
    expect(jobSearchHref(base, { loc: '', page: 1 })).toBe('/jobs?q=sales');
    expect(jobSearchHref(parseJobSearch({}))).toBe('/jobs');
  });

  it('encodes user input', () => {
    expect(jobSearchHref(parseJobSearch({ q: 'R&D lead' }))).toBe('/jobs?q=R%26D+lead');
  });
});

describe('pageWindow', () => {
  it('shows every page when there are few', () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });

  it('shows first, last and neighbours with gaps in between', () => {
    expect(pageWindow(5, 170)).toEqual([1, 'gap', 4, 5, 6, 'gap', 170]);
    expect(pageWindow(1, 170)).toEqual([1, 2, 'gap', 170]);
    expect(pageWindow(170, 170)).toEqual([1, 'gap', 169, 170]);
  });
});
