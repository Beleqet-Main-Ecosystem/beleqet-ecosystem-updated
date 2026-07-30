export default () => {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || '';
  const tls = process.env.REDIS_TLS === 'true';

  const redisUrl = new URL(`redis://${host}:${port}`);
  if (password) {
    redisUrl.password = password;
  }
  if (tls) {
    redisUrl.searchParams.set('tls', 'true');
  }

  return {
    redis: {
      url: redisUrl.toString(),
      ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS ?? '60', 10),
      prefix: process.env.CACHE_PREFIX || 'beleqet:',
      debug: process.env.CACHE_DEBUG === 'true',
    },
    security: {
      piiSalt: process.env.PII_SALT || 'default-salt',
    },
  };
};
