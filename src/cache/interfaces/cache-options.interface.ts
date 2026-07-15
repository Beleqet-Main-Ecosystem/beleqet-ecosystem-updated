export interface CacheOptions {
  ttl?: number;          // in seconds
  namespace?: string;
  skipCache?: boolean;   // if true, bypass cache and directly call fetchFn
}