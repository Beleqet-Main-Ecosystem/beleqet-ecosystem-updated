// Import-assignment is required here: without `esModuleInterop` a default
// import of this CommonJS module would be `undefined` at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import session = require('express-session');
import type Redis from 'ioredis';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

type Callback = (err?: unknown) => void;

/**
 * express-session store on the app's shared ioredis client.
 *
 * connect-redis 9 only speaks the node-redis client's API: given ioredis, every session save went
 * out as an invalid SET ("ERR syntax error"), which broke LinkedIn sign-in and crashed the API.
 */
export class IoRedisSessionStore extends session.Store {
  constructor(
    private readonly client: Pick<Redis, 'get' | 'set' | 'del' | 'expire'>,
    private readonly prefix = 'beleqet:sess:',
  ) {
    super();
  }

  get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void): void {
    this.client
      .get(this.prefix + sid)
      .then((value) => callback(null, value ? (JSON.parse(value) as session.SessionData) : null))
      .catch((err: unknown) => callback(err));
  }

  set(sid: string, data: session.SessionData, callback?: Callback): void {
    this.client
      .set(this.prefix + sid, JSON.stringify(data), 'EX', this.ttl(data))
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  }

  destroy(sid: string, callback?: Callback): void {
    this.client
      .del(this.prefix + sid)
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  }

  touch(sid: string, data: session.SessionData, callback?: Callback): void {
    this.client
      .expire(this.prefix + sid, this.ttl(data))
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  }

  /** Seconds until the session cookie expires, so Redis forgets the session with it. */
  private ttl(data: session.SessionData): number {
    const expires = data.cookie?.expires;
    if (expires) return Math.max(1, Math.ceil((new Date(expires).getTime() - Date.now()) / 1000));
    const maxAge = data.cookie?.originalMaxAge;
    return maxAge ? Math.max(1, Math.ceil(maxAge / 1000)) : DEFAULT_TTL_SECONDS;
  }
}
