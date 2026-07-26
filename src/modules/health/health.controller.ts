import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';
import type { LivenessResult } from './health.service';

/**
 * Public, unauthenticated health endpoints used by container HEALTHCHECKs,
 * the CI smoke tests, and the staging deployment gates.
 *
 * `GET /api/v1/health`        — liveness: the process serves HTTP.
 * `GET /api/v1/health/ready`  — readiness: DB and Redis round-trips succeed
 *                               (HTTP 200 when ready, 503 when degraded).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Process is up' })
  liveness(): LivenessResult {
    return this.healthService.liveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (database + Redis)' })
  @ApiResponse({ status: 200, description: 'All dependencies reachable' })
  @ApiResponse({ status: 503, description: 'One or more dependencies down' })
  async readiness(@Res() res: Response): Promise<void> {
    const result = await this.healthService.readiness();
    res.status(result.status === 'ok' ? 200 : 503).json(result);
  }
}
