import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

/** One dependency's readiness: status plus round-trip latency only. */
export interface DependencyHealth {
  status: 'up' | 'down';
  latencyMs: number;
}

/** Aggregate readiness payload. Intentionally free of internal diagnostics. */
export interface ReadinessResult {
  status: 'ok' | 'degraded';
  checks: {
    database: DependencyHealth;
    redis: DependencyHealth;
  };
}

/** Liveness payload: process is up and serving HTTP. */
export interface LivenessResult {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

/**
 * HealthService
 *
 * Backs the deployment pipeline's health gates and the container
 * `HEALTHCHECK`s. Liveness proves the process serves HTTP; readiness performs
 * a bounded round-trip to PostgreSQL (`SELECT 1`) and Redis (`PING`).
 *
 * The response deliberately exposes nothing beyond status and latency — no
 * connection strings, versions, hostnames, or error details.
 */
@Injectable()
export class HealthService {
  /** Per-dependency probe budget; keeps the endpoint bounded under outage. */
  private static readonly PROBE_TIMEOUT_MS = 2_000;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  liveness(): LivenessResult {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<ReadinessResult> {
    const [database, redis] = await Promise.all([
      this.probe(() => this.prisma.$queryRaw`SELECT 1`),
      this.probe(() => this.redis.ping()),
    ]);
    return {
      status: database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded',
      checks: { database, redis },
    };
  }

  private async probe(check: () => Promise<unknown>): Promise<DependencyHealth> {
    const startedAt = Date.now();
    try {
      await this.withTimeout(check(), HealthService.PROBE_TIMEOUT_MS);
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch {
      // The reason is intentionally not surfaced: health responses are public.
      return { status: 'down', latencyMs: Date.now() - startedAt };
    }
  }

  private withTimeout(promise: Promise<unknown>, timeoutMs: number): Promise<unknown> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('health probe timeout')), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }
}
