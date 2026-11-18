import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import type { ReadinessResult } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockService = {
    liveness: jest.fn(),
    readiness: jest.fn(),
  };

  function mockResponse(): { res: Response; status: jest.Mock; json: jest.Mock } {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { res: { status } as unknown as Response, status, json };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockService }],
    }).compile();
    controller = module.get(HealthController);
  });

  it('GET /health delegates to the service', () => {
    const payload = { status: 'ok', uptimeSeconds: 12, timestamp: '2026-07-18T00:00:00.000Z' };
    mockService.liveness.mockReturnValue(payload);
    expect(controller.liveness()).toEqual(payload);
  });

  it('GET /health/ready returns 200 when ready', async () => {
    const payload: ReadinessResult = {
      status: 'ok',
      checks: {
        database: { status: 'up', latencyMs: 3 },
        redis: { status: 'up', latencyMs: 1 },
      },
    };
    mockService.readiness.mockResolvedValue(payload);
    const { res, status, json } = mockResponse();

    await controller.readiness(res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(payload);
  });

  it('GET /health/ready returns 503 when degraded', async () => {
    const payload: ReadinessResult = {
      status: 'degraded',
      checks: {
        database: { status: 'down', latencyMs: 2000 },
        redis: { status: 'up', latencyMs: 1 },
      },
    };
    mockService.readiness.mockResolvedValue(payload);
    const { res, status } = mockResponse();

    await controller.readiness(res);

    expect(status).toHaveBeenCalledWith(503);
  });
});
