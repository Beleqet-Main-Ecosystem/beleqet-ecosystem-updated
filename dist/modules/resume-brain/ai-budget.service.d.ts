import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { AiUsage } from './ai/ai-chat-provider.interface';
export declare class AiBudgetService {
    private readonly redis;
    private readonly config;
    private readonly logger;
    constructor(redis: Redis, config: ConfigService);
    assertWithinBudget(userId?: string): Promise<void>;
    recordUsage(userId: string | undefined, usage: AiUsage): Promise<void>;
    private incrementWithWindow;
    private readCounters;
    private toCount;
    private limits;
    private windowSeconds;
    private requestKey;
    private tokenKey;
}
