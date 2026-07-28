"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = require("ioredis");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    constructor(app) {
        super(app);
        this.app = app;
        this.logger = new common_1.Logger(RedisIoAdapter.name);
    }
    async connectToRedis() {
        const config = this.app.get(config_1.ConfigService);
        const host = config.get('REDIS_HOST', 'localhost');
        const port = config.get('REDIS_PORT', 6379);
        const password = config.get('REDIS_PASSWORD') || undefined;
        const useTls = config.get('REDIS_TLS', 'false') === 'true';
        const redisOptions = {
            host,
            port,
            password,
            ...(useTls ? { tls: {} } : {}),
        };
        this.pubClient = new ioredis_1.default(redisOptions);
        this.subClient = this.pubClient.duplicate();
        this.pubClient.on('error', (err) => this.logger.error(`[RedisIoAdapter] Pub client error: ${err.message}`));
        this.subClient.on('error', (err) => this.logger.error(`[RedisIoAdapter] Sub client error: ${err.message}`));
        await this.pubClient.ping();
        this.adapterConstructor = (0, redis_adapter_1.createAdapter)(this.pubClient, this.subClient);
        this.logger.log('[RedisIoAdapter] Connected — WebSocket state synced via Redis Pub/Sub');
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        if (!this.adapterConstructor) {
            this.logger.warn('[RedisIoAdapter] connectToRedis() was not called before server creation — falling back to in-memory adapter');
            return server;
        }
        server.adapter(this.adapterConstructor);
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
//# sourceMappingURL=redis-io.adapter.js.map