export const SUPPORTED_CURRENCIES = ['ETB', 'USD', 'EUR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const VALID_LOCATIONS = [
  'Addis Ababa',
  'Bahir Dar',
  'Hawassa',
  'Mekelle',
  'Adama',
  'Dire Dawa',
  'Gondar',
  'Jimma',
  'Remote',
] as const;

export const DEFAULT_SEARCH_PAGE = 1;
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 100;
export const MAX_SKILLS_FILTER = 20;
