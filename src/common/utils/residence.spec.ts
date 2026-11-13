import { cityName, countryCode, genderFits, userGender } from './residence';

describe('residence helpers', () => {
  it('reads gender, country and city as people type or tap them', () => {
    expect(userGender(' female ')).toBe('FEMALE');
    expect(userGender('Both')).toBeNull();
    expect(countryCode('et')).toBe('ET');
    expect(countryCode('Ethiopia')).toBeNull();
    expect(cityName('  Addis   Ababa ')).toBe('Addis Ababa');
    expect(cityName('')).toBeNull();
    expect(cityName('x'.repeat(200))).toHaveLength(80);
  });

  it('rules someone out of a gender-specific job only when they said the other gender', () => {
    expect(genderFits('FEMALE', 'MALE')).toBe(false);
    expect(genderFits('FEMALE', 'FEMALE')).toBe(true);
    expect(genderFits('FEMALE', null)).toBe(true);
    expect(genderFits('ANY', 'MALE')).toBe(true);
    expect(genderFits(null, 'MALE')).toBe(true);
  });
});
