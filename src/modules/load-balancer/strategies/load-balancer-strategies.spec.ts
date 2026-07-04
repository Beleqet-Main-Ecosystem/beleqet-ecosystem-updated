import { RoundRobinStrategy } from './round-robin.strategy';
import { LeastConnectionsStrategy } from './least-connections.strategy';
import { IpHashStrategy } from './ip-hash.strategy';
import { BackendInstance } from '../interfaces/backend-instance.interface';

const makeBackend = (id: string, connections = 0): BackendInstance => ({
  id,
  url: `http://${id}:4000`,
  region: 'ET',
  supportedCurrencies: ['ETB'],
  activeConnections: connections,
  healthy: true,
  lastHealthCheckAt: null,
  weight: 1,
});

describe('RoundRobinStrategy', () => {
  let strategy: RoundRobinStrategy;

  beforeEach(() => {
    strategy = new RoundRobinStrategy();
    strategy.resetCursor();
  });

  it('should rotate through backends sequentially', () => {
    const pool = [makeBackend('a'), makeBackend('b'), makeBackend('c')];
    const ctx = { clientIp: '10.0.0.1' };

    expect(strategy.select(pool, ctx)?.id).toBe('a');
    expect(strategy.select(pool, ctx)?.id).toBe('b');
    expect(strategy.select(pool, ctx)?.id).toBe('c');
    expect(strategy.select(pool, ctx)?.id).toBe('a');
  });

  it('should return null for an empty pool', () => {
    expect(strategy.select([], { clientIp: '10.0.0.1' })).toBeNull();
  });
});

describe('LeastConnectionsStrategy', () => {
  let strategy: LeastConnectionsStrategy;

  beforeEach(() => {
    strategy = new LeastConnectionsStrategy();
  });

  it('should pick the backend with fewest active connections', () => {
    const pool = [makeBackend('heavy', 10), makeBackend('light', 2), makeBackend('mid', 5)];
    const selected = strategy.select(pool, { clientIp: '10.0.0.1' });
    expect(selected?.id).toBe('light');
  });
});

describe('IpHashStrategy', () => {
  let strategy: IpHashStrategy;

  beforeEach(() => {
    strategy = new IpHashStrategy();
  });

  it('should consistently map the same IP to the same backend', () => {
    const pool = [makeBackend('a'), makeBackend('b'), makeBackend('c')];
    const ctx = { clientIp: '203.0.113.50' };

    const first = strategy.select(pool, ctx);
    const second = strategy.select(pool, ctx);
    expect(first?.id).toBe(second?.id);
  });

  it('should use sessionId over clientIp when provided', () => {
    const pool = [makeBackend('a'), makeBackend('b')];
    const ctx = { clientIp: '1.1.1.1', sessionId: 'session-abc-12345' };

    const first = strategy.select(pool, ctx);
    const second = strategy.select(pool, { clientIp: '9.9.9.9', sessionId: 'session-abc-12345' });
    expect(first?.id).toBe(second?.id);
  });
});
