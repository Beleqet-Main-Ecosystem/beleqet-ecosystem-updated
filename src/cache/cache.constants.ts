export const CACHE_TTL = {
  PORTFOLIO_METRICS: 300,
  MARKETPLACE_LISTINGS: 60,
  PRICE_DATA: 30,
  STATIC_REFERENCES: 86400,
} as const;

export type CacheTtlKey = keyof typeof CACHE_TTL;
