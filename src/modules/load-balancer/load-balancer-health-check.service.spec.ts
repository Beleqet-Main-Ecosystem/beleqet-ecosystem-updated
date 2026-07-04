import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { LoadBalancerHealthCheckService } from './load-balancer-health-check.service';
import { LoadBalancerService } from './load-balancer.service';
import { LoadBalancerStrategyFactory } from './strategies/load-balancer-strategy.factory';
import { RoundRobinStrategy } from './strategies/round-robin.strategy';
import { LeastConnectionsStrategy } from './strategies/least-connections.strategy';
import { IpHashStrategy } from './strategies/ip-hash.strategy';
import { LoadBalancerStrategy } from './constants/load-balancer.constants';

const mockI18n = { translate: jest.fn((key: string) => key) };

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const values: Record<string, string> = {
      LOAD_BALANCER_STRATEGY: LoadBalancerStrategy.ROUND_ROBIN,
      LOAD_BALANCER_STICKY_SESSIONS: 'false',
      LOAD_BALANCER_HEALTH_CHECK_INTERVAL_MS: '60000',
      LOAD_BALANCER_HEALTH_CHECK_TIMEOUT_MS: '1000',
      LOAD_BALANCER_HEALTH_CHECK_PATH: '/api/v1/load-balancer/ping',
      LOAD_BALANCER_BACKENDS: '',
    };
    return values[key] ?? defaultValue;
  }),
};

describe('LoadBalancerHealthCheckService', () => {
  let healthService: LoadBalancerHealthCheckService;
  let loadBalancerService: LoadBalancerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoadBalancerHealthCheckService,
        LoadBalancerService,
        LoadBalancerStrategyFactory,
        RoundRobinStrategy,
        LeastConnectionsStrategy,
        IpHashStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();

    healthService = module.get<LoadBalancerHealthCheckService>(LoadBalancerHealthCheckService);
    loadBalancerService = module.get<LoadBalancerService>(LoadBalancerService);
  });

  afterEach(() => {
    healthService.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(healthService).toBeDefined();
  });

  it('should mark unreachable backends as unhealthy', async () => {
    loadBalancerService.registerBackend({
      id: 'offline',
      url: 'http://127.0.0.1:59999',
    });

    const result = await healthService.runHealthChecks();
    expect(result.checked).toBe(1);
    expect(result.unhealthy).toBe(1);

    const status = loadBalancerService.getStatus();
    expect(status.healthyBackends).toBe(0);
  });
});
