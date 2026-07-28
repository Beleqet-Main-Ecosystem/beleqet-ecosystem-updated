import type Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
export interface DependencyHealth {
    status: 'up' | 'down';
    latencyMs: number;
}
export interface ReadinessResult {
    status: 'ok' | 'degraded';
    checks: {
        database: DependencyHealth;
        redis: DependencyHealth;
    };
}
export interface LivenessResult {
    status: 'ok';
    uptimeSeconds: number;
    timestamp: string;
}
export declare class HealthService {
    private readonly prisma;
    private readonly redis;
    private static readonly PROBE_TIMEOUT_MS;
    constructor(prisma: PrismaService, redis: Redis);
    liveness(): LivenessResult;
    readiness(): Promise<ReadinessResult>;
    private probe;
    private withTimeout;
}
