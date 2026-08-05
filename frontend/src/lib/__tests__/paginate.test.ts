import { paginateItems, RECENT_PROJECTS_PAGE_SIZE } from '../paginate';

describe('paginateItems', () => {
  const items = Array.from({ length: 21 }, (_, i) => ({ id: `p${i + 1}` }));

  it('defaults to 8 items per page', () => {
    expect(RECENT_PROJECTS_PAGE_SIZE).toBe(8);
    const slice = paginateItems(items, 1);
    expect(slice.items).toHaveLength(8);
    expect(slice.totalPages).toBe(3);
    expect(slice.fromIndex).toBe(1);
    expect(slice.toIndex).toBe(8);
  });

  it('returns the second page of 8', () => {
    const slice = paginateItems(items, 2);
    expect(slice.items.map((i) => i.id)).toEqual([
      'p9',
      'p10',
      'p11',
      'p12',
      'p13',
      'p14',
      'p15',
      'p16',
    ]);
    expect(slice.fromIndex).toBe(9);
    expect(slice.toIndex).toBe(16);
  });

  it('returns a short final page', () => {
    const slice = paginateItems(items, 3);
    expect(slice.items).toHaveLength(5);
    expect(slice.fromIndex).toBe(17);
    expect(slice.toIndex).toBe(21);
  });

  it('clamps out-of-range pages', () => {
    expect(paginateItems(items, 0).page).toBe(1);
    expect(paginateItems(items, 99).page).toBe(3);
  });

  it('handles an empty list', () => {
    const slice = paginateItems([], 1);
    expect(slice).toMatchObject({
      page: 1,
      totalPages: 1,
      totalItems: 0,
      fromIndex: 0,
      toIndex: 0,
      items: [],
    });
  });
});
