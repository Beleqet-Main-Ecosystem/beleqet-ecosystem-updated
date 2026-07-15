import * as fs from 'fs';
import * as path from 'path';

/**
 * Validates the Nginx load-balancer config used for Performance & Network (#41).
 * Ensures strategies, health checks, failover, WebSocket upgrades, and sticky sessions.
 */
describe('Nginx load-balancer configuration', () => {
  const confPath = path.join(
    __dirname,
    '../../../infrastructure/nginx/load-balancer.conf',
  );

  let conf: string;

  beforeAll(() => {
    conf = fs.readFileSync(confPath, 'utf8');
  });

  it('should define an upstream pool with both backends', () => {
    expect(conf).toMatch(/upstream\s+beleqet_backend/);
    expect(conf).toContain('server backend-1:4000');
    expect(conf).toContain('server backend-2:4000');
  });

  it('should enable ip_hash sticky sessions by default for Socket.IO', () => {
    expect(conf).toMatch(/upstream\s+beleqet_backend\s*\{[^}]*ip_hash;/s);
  });

  it('should document least_conn and round-robin alternatives', () => {
    expect(conf).toMatch(/Round Robin/i);
    expect(conf).toContain('least_conn');
  });

  it('should configure passive health checks and failover', () => {
    expect(conf).toMatch(/max_fails=\d+/);
    expect(conf).toMatch(/fail_timeout=\d+s/);
    expect(conf).toContain('proxy_next_upstream');
  });

  it('should expose an LB health endpoint that does not hit backends', () => {
    expect(conf).toContain('/lb-health');
    expect(conf).toMatch(/return\s+200/);
  });

  it('should forward multi-currency and region headers', () => {
    expect(conf).toContain('X-Currency');
    expect(conf).toContain('X-Region');
  });

  it('should proxy traffic through the upstream pool', () => {
    expect(conf).toContain('proxy_pass http://beleqet_backend');
  });

  it('should set WebSocket upgrade headers', () => {
    expect(conf).toContain('proxy_set_header Upgrade $http_upgrade');
    expect(conf).toContain('proxy_set_header Connection $connection_upgrade');
    expect(conf).toMatch(/map\s+\$http_upgrade\s+\$connection_upgrade/);
  });

  it('should have a dedicated /socket.io/ location for chat', () => {
    expect(conf).toContain('location /socket.io/');
    expect(conf).toMatch(/proxy_read_timeout\s+86400s/);
  });
});
