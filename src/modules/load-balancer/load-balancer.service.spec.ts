import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { LoadBalancerService } from './load-balancer.service';
import { LoadBalancerStrategyFactory } from './strategies/load-balancer-strategy.factory';
import { RoundRobinStrategy } from './strategies/round-robin.strategy';
import { LeastConnectionsStrategy } from './strategies/least-connections.strategy';
import { IpHashStrategy } from './strategies/ip-hash.strategy';
import { LoadBalancerStrategy } from './constants/load-balancer.constants';

const mockI18n = {
  translate: jest.fn((key: string) => key),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const values: Record<string, string> = {
      LOAD_BALANCER_STRATEGY: LoadBalancerStrategy.ROUND_ROBIN,
      LOAD_BALANCER_STICKY_SESSIONS: 'true',
      LOAD_BALANCER_HEALTH_CHECK_INTERVAL_MS: '30000',
      LOAD_BALANCER_HEALTH_CHECK_TIMEOUT_MS: '5000',
      LOAD_BALANCER_HEALTH_CHECK_PATH: '/api/v1/load-balancer/ping',
      LOAD_BALANCER_BACKENDS: '',
    };
    return values[key] ?? defaultValue;
  }),
};

describe('LoadBalancerService', () => {
  let service: LoadBalancerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoadBalancerService,
        LoadBalancerStrategyFactory,
        RoundRobinStrategy,
        LeastConnectionsStrategy,
        IpHashStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();

    service = module.get<LoadBalancerService>(LoadBalancerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register and list backends', () => {
    const backend = service.registerBackend({
      id: 'test-backend',
      url: 'http://localhost:4001',
      region: 'ET',
      supportedCurrencies: ['ETB', 'USD'],
    });

    expect(backend.id).toBe('test-backend');
    expect(backend.supportedCurrencies).toEqual(['ETB', 'USD']);

    const list = service.listBackends(false) as Array<{ id: string }>;
    expect(list.some((b) => b.id === 'test-backend')).toBe(true);
  });

  it('should route requests to registered backends', () => {
    service.registerBackend({
      id: 'route-target',
      url: 'http://localhost:4002',
    });

    const result = service.routeRequest({ clientIp: '10.0.0.5' });
    expect(result.backendId).toBe('route-target');
    expect(result.targetUrl).toBe('http://localhost:4002');
  });

  it('should filter backends by currency for multi-currency routing', () => {
    service.registerBackend({
      id: 'etb-only',
      url: 'http://localhost:4003',
      supportedCurrencies: ['ETB'],
    });
    service.registerBackend({
      id: 'usd-only',
      url: 'http://localhost:4004',
      supportedCurrencies: ['USD'],
    });

    const result = service.routeRequest({ clientIp: '10.0.0.1', currency: 'USD' });
    expect(result.backendId).toBe('usd-only');
  });

  it('should maintain sticky session affinity', () => {
    service.registerBackend({ id: 'sticky-a', url: 'http://localhost:4010' });
    service.registerBackend({ id: 'sticky-b', url: 'http://localhost:4011' });

    service.updateConfig({ strategy: LoadBalancerStrategy.ROUND_ROBIN, stickySessionsEnabled: true });

    const first = service.routeRequest({
      clientIp: '10.0.0.1',
      sessionId: 'sticky-session-001',
    });
    const second = service.routeRequest({
      clientIp: '10.0.0.99',
      sessionId: 'sticky-session-001',
    });

    expect(first.backendId).toBe(second.backendId);
  });

  it('should mark backends unhealthy and exclude them from routing', () => {
    service.registerBackend({ id: 'sick', url: 'http://localhost:4020' });
    service.setBackendHealth('sick', false);

    expect(() => service.routeRequest({ clientIp: '10.0.0.1' })).toThrow();
  });
});
