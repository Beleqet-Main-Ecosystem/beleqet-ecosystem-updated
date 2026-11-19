import { IoRedisSessionStore } from './ioredis-session.store';

/** In-memory stand-in for the four ioredis calls the store uses. */
function fakeRedis() {
  const data = new Map<string, { value: string; ttl: number }>();
  return {
    data,
    get: jest.fn(async (key: string) => data.get(key)?.value ?? null),
    set: jest.fn(async (key: string, value: string, mode: string, ttl: number) => {
      // ioredis' positional form; anything else is what produced "ERR syntax error".
      if (mode !== 'EX' || !Number.isInteger(ttl)) throw new Error('ERR syntax error');
      data.set(key, { value, ttl });
      return 'OK';
    }),
    del: jest.fn(async (key: string) => (data.delete(key) ? 1 : 0)),
    expire: jest.fn(async (key: string, ttl: number) => {
      const entry = data.get(key);
      if (entry) entry.ttl = ttl;
      return entry ? 1 : 0;
    }),
  };
}

const call = (fn: (cb: (err?: unknown, value?: unknown) => void) => void) =>
  new Promise<unknown>((resolve, reject) =>
    fn((err, value) => (err ? reject(err) : resolve(value))),
  );

describe('IoRedisSessionStore', () => {
  const session = { cookie: { originalMaxAge: 60_000 }, state: 'abc' } as never;

  it('saves with an expiry ioredis accepts, and reads it back', async () => {
    const redis = fakeRedis();
    const store = new IoRedisSessionStore(redis as never);

    await call((cb) => store.set('sid1', session, cb));
    expect(redis.set).toHaveBeenCalledWith('beleqet:sess:sid1', expect.any(String), 'EX', 60);
    await expect(call((cb) => store.get('sid1', cb))).resolves.toEqual(session);
  });

  it('returns nothing for an unknown session', async () => {
    const store = new IoRedisSessionStore(fakeRedis() as never);
    await expect(call((cb) => store.get('missing', cb))).resolves.toBeNull();
  });

  it('follows the cookie expiry, and refreshes it on touch', async () => {
    const redis = fakeRedis();
    const store = new IoRedisSessionStore(redis as never);
    const expiring = { cookie: { expires: new Date(Date.now() + 120_000) } } as never;

    await call((cb) => store.set('sid2', expiring, cb));
    expect(redis.data.get('beleqet:sess:sid2')?.ttl).toBeGreaterThanOrEqual(119);
    await call((cb) => store.touch('sid2', session, cb));
    expect(redis.data.get('beleqet:sess:sid2')?.ttl).toBe(60);
  });

  it('destroys a session', async () => {
    const redis = fakeRedis();
    const store = new IoRedisSessionStore(redis as never);
    await call((cb) => store.set('sid3', session, cb));
    await call((cb) => store.destroy('sid3', cb));
    await expect(call((cb) => store.get('sid3', cb))).resolves.toBeNull();
  });

  it('passes Redis failures to the callback instead of throwing', async () => {
    const redis = fakeRedis();
    redis.get.mockRejectedValueOnce(new Error('down'));
    const store = new IoRedisSessionStore(redis as never);
    await expect(call((cb) => store.get('x', cb))).rejects.toThrow('down');
  });
});
