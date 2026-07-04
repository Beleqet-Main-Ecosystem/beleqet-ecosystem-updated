import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  RegisterBackendDto,
  RouteRequestDto,
  UpdateLoadBalancerConfigDto,
} from './dto/load-balancer.dto';
import { LoadBalancerHealthCheckService } from './load-balancer-health-check.service';
import { LoadBalancerService } from './load-balancer.service';

type RequestWithIp = Request & { ip?: string };

/**
 * REST API for load-balancer management, routing, and health monitoring.
 * Public endpoints expose minimal data (GDPR). Admin endpoints require JWT + ADMIN role.
 */
@ApiTags('load-balancer')
@Controller('load-balancer')
export class LoadBalancerController {
  constructor(
    private readonly loadBalancerService: LoadBalancerService,
    private readonly healthCheckService: LoadBalancerHealthCheckService,
  ) {}

  /**
   * Lightweight ping endpoint used by Nginx upstream health checks.
   */
  @Get('ping')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health ping for upstream probes (public)' })
  ping() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Aggregate load-balancer status — safe for public monitoring.
   */
  @Get('status')
  @ApiOperation({ summary: 'Load-balancer pool status (public)' })
  getStatus() {
    return this.loadBalancerService.getStatus();
  }

  /**
   * List backends without exposing internal URLs (GDPR data minimization).
   */
  @Get('backends')
  @ApiOperation({ summary: 'List backend pool (public — URLs hidden)' })
  listBackendsPublic() {
    return this.loadBalancerService.listBackends(false);
  }

  /**
   * Route an incoming request to the optimal backend instance.
   * Supports X-Currency and X-Region headers for global scaling.
   */
  @Post('route')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Select backend for an incoming request' })
  @ApiHeader({ name: 'X-Currency', required: false, description: 'ISO 4217 currency code' })
  @ApiHeader({ name: 'X-Region', required: false, description: 'ISO 3166-1 alpha-2 region' })
  @ApiHeader({ name: 'X-Session-Id', required: false, description: 'Sticky session identifier' })
  routeRequest(
    @Body() dto: RouteRequestDto,
    @Headers('x-currency') currencyHeader: string | undefined,
    @Headers('x-region') regionHeader: string | undefined,
    @Headers('x-session-id') sessionHeader: string | undefined,
    @Req() req: RequestWithIp,
  ) {
    const enriched: RouteRequestDto = {
      ...dto,
      currency: dto.currency ?? currencyHeader,
      region: dto.region ?? regionHeader,
      sessionId: dto.sessionId ?? sessionHeader,
    };

    const clientIp = req.ip ?? req.socket.remoteAddress ?? '127.0.0.1';
    return this.loadBalancerService.routeRequest(enriched, clientIp);
  }

  /** Release a connection slot after request completion. */
  @Post('release/:backendId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Decrement active connection count for a backend' })
  releaseConnection(@Param('backendId') backendId: string) {
    this.loadBalancerService.releaseConnection(backendId);
  }

  // ── Admin-only endpoints ───────────────────────────────────────────────────

  @Get('admin/backends')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List backends with internal URLs (admin audit)' })
  listBackendsAdmin() {
    return this.loadBalancerService.listBackends(true);
  }

  @Get('admin/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get load-balancer configuration' })
  getConfig() {
    return this.loadBalancerService.getConfig();
  }

  @Patch('admin/config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update load-balancer configuration' })
  updateConfig(@Body() dto: UpdateLoadBalancerConfigDto) {
    return this.loadBalancerService.updateConfig(dto);
  }

  @Post('admin/backends')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a backend instance' })
  registerBackend(@Body() dto: RegisterBackendDto) {
    return this.loadBalancerService.registerBackend(dto);
  }

  @Delete('admin/backends/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a backend instance' })
  removeBackend(@Param('id') id: string) {
    return this.loadBalancerService.removeBackend(id);
  }

  @Post('admin/health-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger an immediate health-check cycle' })
  triggerHealthCheck() {
    return this.healthCheckService.runHealthChecks();
  }
}
