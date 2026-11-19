import { jobSearchHref, pageWindow, parseJobSearch, toggleType } from '../search-params';

describe('parseJobSearch', () => {
  it('reads every supported parameter', () => {
    expect(parseJobSearch({ q: ' accountant ', loc: 'Addis Ababa', category: 'health-care', type: 'remote', page: '3' })).toEqual({
      q: 'accountant',
      loc: 'Addis Ababa',
      category: 'health-care',
      types: ['REMOTE'],
      company: '',
      salary: 0,
      level: '',
      posted: 0,
      sort: 'newest',
      page: 3,
    });
  });

  it('reads salary, experience, date posted and sort, keeping only the offered values', () => {
    expect(parseJobSearch({ salary: '10000', level: 'senior', posted: '7', sort: 'salary' })).toMatchObject({ salary: 10000, level: 'Senior', posted: 7, sort: 'salary' });
    expect(parseJobSearch({ salary: '12345', level: 'Wizard', posted: '99', sort: 'random' })).toMatchObject({ salary: 0, level: '', posted: 0, sort: 'newest' });
  });

  it('drops values the API would reject', () => {
    const search = parseJobSearch({ type: 'INTERNSHIP', page: '-2' });
    expect(search.types).toEqual([]);
    expect(search.page).toBe(1);
    expect(parseJobSearch({ page: 'abc' }).page).toBe(1);
  });

  it('reads several job types, in a fixed order, without repeats', () => {
    expect(parseJobSearch({ type: 'remote,full_time,REMOTE,bogus' }).types).toEqual(['FULL_TIME', 'REMOTE']);
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

  it('writes the new filters and leaves out their defaults', () => {
    const search = parseJobSearch({ salary: '20000', level: 'Junior', posted: '1', sort: 'salary' });
    expect(jobSearchHref(search)).toBe('/jobs?salary=20000&level=Junior&posted=1&sort=salary');
    expect(jobSearchHref(search, { salary: 0, level: '', posted: 0, sort: 'newest' })).toBe('/jobs');
  });

  it('leaves out empty values and page 1', () => {
    expect(jobSearchHref(base, { loc: '', page: 1 })).toBe('/jobs?q=sales');
    expect(jobSearchHref(parseJobSearch({}))).toBe('/jobs');
  });

  it('writes several job types as one parameter', () => {
    expect(jobSearchHref(parseJobSearch({}), { types: ['REMOTE', 'FULL_TIME'] })).toBe('/jobs?type=FULL_TIME%2CREMOTE');
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

describe('toggleType', () => {
  it('adds and removes a type, keeping the order', () => {
    expect(toggleType(['REMOTE'], 'FULL_TIME')).toEqual(['FULL_TIME', 'REMOTE']);
    expect(toggleType(['FULL_TIME', 'REMOTE'], 'REMOTE')).toEqual(['FULL_TIME']);
  });
});
