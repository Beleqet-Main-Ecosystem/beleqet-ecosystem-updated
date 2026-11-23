/** The API every screen talks to (set per build profile in eas.json). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

/** The website, for links people share and pages the app opens in the browser. */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://beleqetjobs.com';
