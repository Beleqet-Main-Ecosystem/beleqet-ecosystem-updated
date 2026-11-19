/** A person's gender, as job posts can ask for it ("ANY" there means either). */
export const USER_GENDERS = ['MALE', 'FEMALE'] as const;
export type UserGender = (typeof USER_GENDERS)[number];

/** ISO 3166-1 alpha-2, e.g. "ET". */
export const COUNTRY_CODE = /^[A-Z]{2}$/;

export const CITY_MAX_LENGTH = 80;

/** The gender a person gave, or null for anything else (old imports, typos). */
export function userGender(value: unknown): UserGender | null {
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return (USER_GENDERS as readonly string[]).includes(upper) ? (upper as UserGender) : null;
}

export function countryCode(value: unknown): string | null {
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return COUNTRY_CODE.test(upper) ? upper : null;
}

/** "addis  ababa " -> "addis ababa"; casing is kept, so bot buttons and typed names both work. */
export function cityName(value: unknown): string | null {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return text ? text.slice(0, CITY_MAX_LENGTH) : null;
}

/**
 * Whether a job that asks for a gender suits this person. Anyone qualifies for "ANY" or no
 * requirement, and someone who hasn't said is not ruled out.
 */
export function genderFits(
  jobGender: string | null | undefined,
  personGender: string | null | undefined,
) {
  const wanted = userGender(jobGender);
  const own = userGender(personGender);
  return !wanted || !own || wanted === own;
}
