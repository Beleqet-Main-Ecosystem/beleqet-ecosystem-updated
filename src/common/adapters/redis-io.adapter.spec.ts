import { ConfigService } from '@nestjs/config';
import { INestApplicationContext } from '@nestjs/common';
import { RedisIoAdapter } from './redis-io.adapter';

// Mock ioredis so tests never attempt a real network connection
jest.mock('ioredis', () => {
  const mockRedis = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    duplicate: jest.fn().mockReturnThis(),
    ping: jest.fn().mockResolvedValue('PONG'),
  }));
  return { __esModule: true, default: mockRedis };
});

// Mock @socket.io/redis-adapter so we don't depend on its real implementation
jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn().mockReturnValue('mock-adapter-constructor'),
}));

/** Minimal typed stand-in for ConfigService, just the `get` method we use */
type MockConfigService = Pick<ConfigService, 'get'>;

/** Minimal typed stand-in for INestApplicationContext, just `get` */
type MockAppContext = Pick<INestApplicationContext, 'get'>;

describe('RedisIoAdapter', () => {
  const configValues: Record<string, unknown> = {
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    REDIS_TLS: 'false',
  };

  const mockConfigService: MockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown) => configValues[key] ?? defaultValue) as ConfigService['get'],
  };

  const mockApp: MockAppContext = {
    get: jest.fn().mockReturnValue(mockConfigService) as INestApplicationContext['get'],
  };

  let adapter: RedisIoAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new RedisIoAdapter(mockApp as INestApplicationContext);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should connect to Redis and build the adapter constructor', async () => {
    await adapter.connectToRedis();
    expect(mockApp.get).toHaveBeenCalledWith(ConfigService);
  });

  it('should attach the Redis adapter to the server after connecting', async () => {
    await adapter.connectToRedis();

    const mockServer = { adapter: jest.fn() };
    jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), 'createIOServer')
      .mockReturnValue(mockServer);

    const result = adapter.createIOServer(4000);

    expect(mockServer.adapter).toHaveBeenCalledWith('mock-adapter-constructor');
    expect(result).toBe(mockServer);
  });

  it('should fall back to the default adapter if connectToRedis was never called', () => {
    const mockServer = { adapter: jest.fn() };
    jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(adapter)), 'createIOServer')
      .mockReturnValue(mockServer);

    const result = adapter.createIOServer(4000);

    expect(mockServer.adapter).not.toHaveBeenCalled();
    expect(result).toBe(mockServer);
  });
});