import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler'; // Import this
import type { Response } from 'express';
import { HealthService } from './health.service';
import type { LivenessResult } from './health.service';

@ApiTags('health')
@SkipThrottle() // FIX: Ensures CI infrastructure probes are never blocked by the rate limiter
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