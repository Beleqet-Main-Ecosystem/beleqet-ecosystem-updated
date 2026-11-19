import { canTakeDown, parseFeatures } from '@/lib/rules';
import { niceMax } from '@/components/ColumnChart';
import { query } from '@/lib/api';

describe('canTakeDown', () => {
  it('offers take-down only where the API allows it', () => {
    expect(canTakeDown({ type: 'JOB', status: 'PUBLISHED' })).toBe(true);
    expect(canTakeDown({ type: 'JOB', status: 'ARCHIVED' })).toBe(false);
    expect(canTakeDown({ type: 'GIG', status: 'OPEN' })).toBe(true);
    expect(canTakeDown({ type: 'GIG', status: 'CANCELLED' })).toBe(false);
    expect(canTakeDown({ type: 'GIG', status: 'IN_PROGRESS' })).toBe(false);
    expect(canTakeDown({ type: 'GIG', status: 'FUNDED' })).toBe(false);
  });
});

describe('parseFeatures', () => {
  it('accepts JSON objects only', () => {
    expect(parseFeatures('{"maxJobPosts": 5}')).toEqual({ maxJobPosts: 5 });
    expect(parseFeatures('')).toEqual({});
    expect(parseFeatures('[1]')).toBeNull();
    expect(parseFeatures('{oops')).toBeNull();
  });
});

describe('niceMax', () => {
  it('rounds the axis up to a clean number', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(12)).toBe(20);
    expect(niceMax(430)).toBe(500);
  });
});

describe('query', () => {
  it('drops empty values', () => {
    expect(query({ a: 1, b: '', c: undefined, d: 'x y' })).toBe('?a=1&d=x+y');
    expect(query({})).toBe('');
  });
});
