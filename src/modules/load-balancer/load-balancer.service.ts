import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import {
  DEFAULT_HEALTH_CHECK_INTERVAL_MS,
  DEFAULT_HEALTH_CHECK_PATH,
  LoadBalancerStrategy,
} from './constants/load-balancer.constants';
import {
  RegisterBackendDto,
  RouteRequestDto,
  UpdateLoadBalancerConfigDto,
} from './dto/load-balancer.dto';
import {
  BackendInstance,
  BackendPublicView,
} from './interfaces/backend-instance.interface';
import { LoadBalancerConfig } from './interfaces/load-balancer-config.interface';
import { RouteContext } from './interfaces/load-balancer-strategy.interface';
import { LoadBalancerStrategyFactory } from './strategies/load-balancer-strategy.factory';
import { pseudonymizeIp, toPublicBackendView } from './utils/gdpr-sanitize.util';

/** Sticky-session affinity map: sessionId → backendId */
type StickySessionMap = Map<string, string>;

/**
 * Core load-balancer service — manages backend pools, routing, and session affinity.
 * Supports multi-currency and region-aware routing for global scaling.
 */
@Injectable()
export class LoadBalancerService {
  private readonly logger = new Logger(LoadBalancerService.name);

  private readonly backends = new Map<string, BackendInstance>();

  private readonly stickySessions: StickySessionMap = new Map();

  private config: LoadBalancerConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly strategyFactory: LoadBalancerStrategyFactory,
    private readonly i18n: I18nService,
  ) {
    this.config = this.buildInitialConfig();
    this.bootstrapBackendsFromEnv();
  }

  /**
   * Return the current load-balancer configuration (safe for admin audit).
   */
  getConfig(): LoadBalancerConfig {
    return { ...this.config };
  }

  /**
   * Update runtime configuration (admin only).
   * @param dto - Partial configuration patch validated by class-validator.
   */
  updateConfig(dto: UpdateLoadBalancerConfigDto): LoadBalancerConfig {
    this.config = {
      ...this.config,
      ...(dto.strategy !== undefined && { strategy: dto.strategy }),
      ...(dto.stickySessionsEnabled !== undefined && {
        stickySessionsEnabled: dto.stickySessionsEnabled,
      }),
      ...(dto.healthCheckIntervalMs !== undefined && {
        healthCheckIntervalMs: dto.healthCheckIntervalMs,
      }),
      ...(dto.healthCheckPath !== undefined && { healthCheckPath: dto.healthCheckPath }),
    };
    this.logger.log(`Load-balancer config updated: strategy=${this.config.strategy}`);
    return this.getConfig();
  }

  /**
   * Register a new backend instance in the pool.
   * @param dto - Validated backend registration payload.
   */
  registerBackend(dto: RegisterBackendDto): BackendPublicView {
    if (this.backends.has(dto.id)) {
      throw new BadRequestException(
        this.i18n.translate('load-balancer.errors.backendExists', {
          args: { id: dto.id },
        }),
      );
    }

    const instance: BackendInstance = {
      id: dto.id,
      url: dto.url.replace(/\/$/, ''),
      region: dto.region ?? 'ET',
      supportedCurrencies: dto.supportedCurrencies ?? ['ETB'],
      activeConnections: 0,
      healthy: true,
      lastHealthCheckAt: null,
      weight: dto.weight ?? 1,
    };

    this.backends.set(dto.id, instance);
    this.logger.log(`Backend registered: ${dto.id} (${instance.region})`);
    return toPublicBackendView(instance);
  }

  /**
   * Remove a backend from the pool.
   * @param backendId - Identifier of the backend to deregister.
   */
  removeBackend(backendId: string): { removed: boolean } {
    const existed = this.backends.delete(backendId);
    if (!existed) {
      throw new NotFoundException(
        this.i18n.translate('load-balancer.errors.backendNotFound', {
          args: { id: backendId },
        }),
      );
    }

    for (const [sessionId, mappedId] of this.stickySessions.entries()) {
      if (mappedId === backendId) {
        this.stickySessions.delete(sessionId);
      }
    }

    return { removed: true };
  }

  /**
   * List all backends — public view hides internal URLs (GDPR data minimization).
   * @param includeInternal - When true (admin), includes URLs for infrastructure audit.
   */
  listBackends(includeInternal = false): BackendPublicView[] | BackendInstance[] {
    const instances = Array.from(this.backends.values());
    if (includeInternal) {
      return instances.map((b) => ({ ...b }));
    }
    return instances.map(toPublicBackendView);
  }

  /**
   * Select the optimal backend for an incoming request.
   * @param dto - Routing context (IP, session, currency, region).
   * @param clientIpFallback - IP extracted from the HTTP request when dto.clientIp is absent.
   */
  routeRequest(dto: RouteRequestDto, clientIpFallback = '127.0.0.1'): {
    backendId: string;
    targetUrl: string;
    strategy: LoadBalancerStrategy;
    sessionAffinity: boolean;
  } {
    const context = this.buildRouteContext(dto, clientIpFallback);
    const candidates = this.filterCandidates(context);

    if (candidates.length === 0) {
      throw new ServiceUnavailableException(
        this.i18n.translate('load-balancer.errors.noHealthyBackend'),
      );
    }

    let selected: BackendInstance | null = null;

    if (this.config.stickySessionsEnabled && context.sessionId) {
      selected = this.resolveStickyBackend(context.sessionId, candidates);
    }

    if (!selected) {
      const strategy = this.strategyFactory.getStrategy(this.config.strategy);
      selected = strategy.select(candidates, context);
    }

    if (!selected) {
      throw new ServiceUnavailableException(
        this.i18n.translate('load-balancer.errors.routingFailed'),
      );
    }

    if (this.config.stickySessionsEnabled && context.sessionId) {
      this.stickySessions.set(context.sessionId, selected.id);
    }

    selected.activeConnections += 1;

    this.logger.debug(
      `Routed to ${selected.id} via ${this.config.strategy} (client=${pseudonymizeIp(context.clientIp)})`,
    );

    return {
      backendId: selected.id,
      targetUrl: selected.url,
      strategy: this.config.strategy,
      sessionAffinity: this.config.stickySessionsEnabled,
    };
  }

  /**
   * Decrement the active connection count after a request completes.
   * @param backendId - Backend that finished serving a request.
   */
  releaseConnection(backendId: string): void {
    const backend = this.backends.get(backendId);
    if (backend && backend.activeConnections > 0) {
      backend.activeConnections -= 1;
    }
  }

  /**
   * Mark a backend as healthy or unhealthy based on a health-check probe.
   * @param backendId - Target backend identifier.
   * @param healthy - Probe result.
   */
  setBackendHealth(backendId: string, healthy: boolean): void {
    const backend = this.backends.get(backendId);
    if (!backend) return;

    backend.healthy = healthy;
    backend.lastHealthCheckAt = new Date();

    if (!healthy) {
      this.logger.warn(`Backend ${backendId} marked UNHEALTHY`);
    }
  }

  /**
   * Aggregate health statistics for monitoring dashboards.
   */
  getStatus(): {
    totalBackends: number;
    healthyBackends: number;
    strategy: LoadBalancerStrategy;
    stickySessionsEnabled: boolean;
    activeStickySessions: number;
  } {
    const all = Array.from(this.backends.values());
    return {
      totalBackends: all.length,
      healthyBackends: all.filter((b) => b.healthy).length,
      strategy: this.config.strategy,
      stickySessionsEnabled: this.config.stickySessionsEnabled,
      activeStickySessions: this.stickySessions.size,
    };
  }

  /** Return all backend instances for internal health-check iteration. */
  getBackendInstances(): BackendInstance[] {
    return Array.from(this.backends.values());
  }

  /** Health-check configuration consumed by LoadBalancerHealthCheckService. */
  getHealthCheckSettings(): Pick<
    LoadBalancerConfig,
    'healthCheckPath' | 'healthCheckTimeoutMs'
  > {
    return {
      healthCheckPath: this.config.healthCheckPath,
      healthCheckTimeoutMs: this.config.healthCheckTimeoutMs,
    };
  }

  /** Interval for scheduled health checks (ms). */
  getHealthCheckIntervalMs(): number {
    return this.config.healthCheckIntervalMs;
  }

  /**
   * Build routing context from the DTO and request metadata.
   */
  private buildRouteContext(dto: RouteRequestDto, clientIp: string): RouteContext {
    return {
      clientIp: dto.clientIp ?? clientIp,
      sessionId: dto.sessionId,
      currency: dto.currency?.toUpperCase(),
      region: dto.region?.toUpperCase(),
    };
  }

  /**
   * Filter backends by health, currency, and region preferences.
   */
  private filterCandidates(context: RouteContext): BackendInstance[] {
    return Array.from(this.backends.values()).filter((backend) => {
      if (!backend.healthy) return false;
      if (context.currency && !backend.supportedCurrencies.includes(context.currency)) {
        return false;
      }
      if (context.region && backend.region !== context.region) {
        return false;
      }
      return true;
    });
  }

  /**
   * Resolve a sticky-session backend if still healthy; otherwise clear the mapping.
   */
  private resolveStickyBackend(
    sessionId: string,
    candidates: BackendInstance[],
  ): BackendInstance | null {
    const mappedId = this.stickySessions.get(sessionId);
    if (!mappedId) return null;

    const stickyBackend = candidates.find((b) => b.id === mappedId);
    if (!stickyBackend) {
      this.stickySessions.delete(sessionId);
      return null;
    }
    return stickyBackend;
  }

  /**
   * Load initial configuration from environment variables.
   */
  private buildInitialConfig(): LoadBalancerConfig {
    const strategyRaw = this.configService.get<string>(
      'LOAD_BALANCER_STRATEGY',
      LoadBalancerStrategy.ROUND_ROBIN,
    );

    const strategy = Object.values(LoadBalancerStrategy).includes(
      strategyRaw as LoadBalancerStrategy,
    )
      ? (strategyRaw as LoadBalancerStrategy)
      : LoadBalancerStrategy.ROUND_ROBIN;

    return {
      strategy,
      stickySessionsEnabled:
        this.configService.get<string>('LOAD_BALANCER_STICKY_SESSIONS', 'true') === 'true',
      healthCheckIntervalMs: Number(
        this.configService.get<string>(
          'LOAD_BALANCER_HEALTH_CHECK_INTERVAL_MS',
          String(DEFAULT_HEALTH_CHECK_INTERVAL_MS),
        ),
      ),
      healthCheckPath: this.configService.get<string>(
        'LOAD_BALANCER_HEALTH_CHECK_PATH',
        DEFAULT_HEALTH_CHECK_PATH,
      ),
      healthCheckTimeoutMs: Number(
        this.configService.get<string>('LOAD_BALANCER_HEALTH_CHECK_TIMEOUT_MS', '5000'),
      ),
    };
  }

  /**
   * Pre-populate the backend pool from LOAD_BALANCER_BACKENDS env var.
   * Format: id=url:region:currencies;id2=url2:region:currencies
   * Example: backend-1=http://backend-1:4000:ET:ETB,USD
   */
  private bootstrapBackendsFromEnv(): void {
    const raw = this.configService.get<string>('LOAD_BALANCER_BACKENDS', '');
    if (!raw.trim()) return;

    for (const entry of raw.split(';').filter(Boolean)) {
      const [idPart, rest] = entry.split('=');
      if (!idPart || !rest) continue;

      const segments = rest.split(':');
      const url = segments[0];
      const region = segments[1] ?? 'ET';
      const currencies = segments[2]?.split(',').filter(Boolean) ?? ['ETB'];

      this.backends.set(idPart.trim(), {
        id: idPart.trim(),
        url: url.trim(),
        region: region.toUpperCase(),
        supportedCurrencies: currencies.map((c) => c.toUpperCase()),
        activeConnections: 0,
        healthy: true,
        lastHealthCheckAt: null,
        weight: 1,
      });
    }

    this.logger.log(`Bootstrapped ${this.backends.size} backend(s) from environment`);
  }
}
