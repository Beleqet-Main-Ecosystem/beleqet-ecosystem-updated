import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoadBalancerService } from './load-balancer.service';

/**
 * Periodically probes every registered backend and updates health flags.
 * Unhealthy instances are automatically excluded from routing.
 */
@Injectable()
export class LoadBalancerHealthCheckService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoadBalancerHealthCheckService.name);

  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly loadBalancerService: LoadBalancerService) {}

  /**
   * Start the scheduled health-check loop when the module initialises.
   */
  onModuleInit(): void {
    const intervalMs = this.loadBalancerService.getHealthCheckIntervalMs();
    this.intervalHandle = setInterval(() => {
      void this.runHealthChecks();
    }, intervalMs);
    this.logger.log(`Health-check scheduler started (every ${intervalMs}ms)`);
    void this.runHealthChecks();
  }

  /**
   * Clear the interval timer on module shutdown.
   */
  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Probe all backends and update their health status.
   * Can also be triggered manually via the admin API.
   */
  async runHealthChecks(): Promise<{ checked: number; healthy: number; unhealthy: number }> {
    const { healthCheckPath, healthCheckTimeoutMs } =
      this.loadBalancerService.getHealthCheckSettings();
    const backends = this.loadBalancerService.getBackendInstances();

    let healthy = 0;
    let unhealthy = 0;

    await Promise.all(
      backends.map(async (backend) => {
        const isHealthy = await this.probeBackend(
          backend.url,
          healthCheckPath,
          healthCheckTimeoutMs,
        );
        this.loadBalancerService.setBackendHealth(backend.id, isHealthy);
        if (isHealthy) {
          healthy += 1;
        } else {
          unhealthy += 1;
        }
      }),
    );

    this.logger.debug(
      `Health check complete: ${healthy} healthy, ${unhealthy} unhealthy / ${backends.length} total`,
    );

    return { checked: backends.length, healthy, unhealthy };
  }

  /**
   * Perform an HTTP GET health probe against a single backend URL.
   * @param baseUrl - Backend base URL.
   * @param path - Health-check endpoint path.
   * @param timeoutMs - Probe timeout in milliseconds.
   */
  private async probeBackend(
    baseUrl: string,
    path: string,
    timeoutMs: number,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
