import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { ServerOptions } from 'socket.io';
export declare class RedisIoAdapter extends IoAdapter {
    private readonly app;
    private readonly logger;
    private adapterConstructor?;
    private pubClient?;
    private subClient?;
    constructor(app: INestApplicationContext);
    connectToRedis(): Promise<void>;
    createIOServer(port: number, options?: ServerOptions): unknown;
}
