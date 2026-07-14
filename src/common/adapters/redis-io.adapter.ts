import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

/**
 * RedisIoAdapter
 *
 * Extends Nest's default Socket.io adapter to broadcast events through
 * Redis Pub/Sub instead of relying on in-process memory.
 *
 * Why this exists:
 * When the backend runs as multiple instances behind a load balancer
 * (horizontal scaling), a client connected to Instance A and a client
 * connected to Instance B do not share the same in-memory Socket.io
 * server. Without this adapter, `server.to(room).emit(...)` only
 * reaches sockets connected to the *same* instance, silently dropping
 * messages for everyone else — this is the core issue this module
 * solves (Task: Socket Balance).
 *
 * How it works:
 * Two ioredis clients (pub + sub) are created and passed to
 * `@socket.io/redis-adapter`. Every emitted event is published to a
 * Redis channel; every instance subscribes to that channel and
 * re-emits the event to its own locally connected sockets. This keeps
 * all instances in sync regardless of which one a client is attached to.
 *
 * Uses `ioredis` rather than the `redis` package to stay consistent
 * with the rest of the codebase (see BullMQ/queues setup).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  /**
   * Establishes the Redis pub/sub connection pair and builds the
   * Socket.io adapter constructor. Must be called once during
   * bootstrap, before `app.listen()`.
   */
  async connectToRedis(): Promise<void> {
    const config = this.app.get(ConfigService);

    const host = config.get<string>('REDIS_HOST', 'localhost');
    const port = config.get<number>('REDIS_PORT', 6379);
    const password = config.get<string>('REDIS_PASSWORD') || undefined;
    const useTls = config.get<string>('REDIS_TLS', 'false') === 'true';

    const redisOptions = {
      host,
      port,
      password,
      ...(useTls ? { tls: {} } : {}),
    };

    this.pubClient = new Redis(redisOptions);
    this.subClient = this.pubClient.duplicate();

    this.pubClient.on('error', (err: Error) =>
      this.logger.error(`[RedisIoAdapter] Pub client error: ${err.message}`),
    );
    this.subClient.on('error', (err: Error) =>
      this.logger.error(`[RedisIoAdapter] Sub client error: ${err.message}`),
    );

    // Fail fast on startup if Redis is unreachable, rather than silently
    // booting with a WebSocket layer that can never actually sync state
    // across instances. A misconfigured/unreachable Redis should stop
    // the app from starting, not degrade it invisibly.
    await this.pubClient.ping();

    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
    this.logger.log('[RedisIoAdapter] Connected — WebSocket state synced via Redis Pub/Sub');
  }

  /**
   * Overrides Nest's default `createIOServer` to attach the Redis
   * adapter to every Socket.io server/gateway created in the app
   * (e.g. ChatGateway), with no changes required inside the gateways
   * themselves.
   */
  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (!this.adapterConstructor) {
      this.logger.warn(
        '[RedisIoAdapter] connectToRedis() was not called before server creation — falling back to in-memory adapter',
      );
      return server;
    }
    server.adapter(this.adapterConstructor);
    return server;
  }
}