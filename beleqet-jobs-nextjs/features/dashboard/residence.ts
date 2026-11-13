/** Countries offered first in the profile; any other one a profile already has is added. */
export const COUNTRY_CODES = [
  'ET', 'KE', 'DJ', 'SO', 'SD', 'SS', 'ER', 'UG', 'TZ', 'RW', 'EG', 'NG', 'GH', 'ZA',
  'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'JO', 'LB', 'IL', 'YE', 'TR',
  'US', 'CA', 'GB', 'DE', 'FR', 'IT', 'NL', 'SE', 'NO', 'CH', 'AU', 'CN', 'IN', 'JP', 'KR', 'MY',
];

/** Spelled as job locations are, so job alerts match. */
export const ETHIOPIAN_CITIES = [
  'Addis Ababa', 'Adama', 'Bahir Dar', 'Dire Dawa', 'Gondar', 'Hawassa', 'Jimma', 'Jijiga', 'Mekele', 'Dessie',
];

/** Country names in the reader's language, from the browser. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale === 'am' ? 'am' : 'en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}
