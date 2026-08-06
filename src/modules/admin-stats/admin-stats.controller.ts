import { Controller, Get, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { AdminStatsService, PlatformStats } from './admin-stats.service';
import { StatsQueryDto } from './dto/stats-query.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Handles admin statistics routes.
 */
@Controller('admin-stats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) { }

  /**
   * Returns the dashboard statistics for admin users.
   */
  @Get('dashboard')
  @Roles('ADMIN')
  async getDashboard(
    @Query(new ValidationPipe({ transform: true })) query: StatsQueryDto,
  ): Promise<PlatformStats> {
    return this.adminStatsService.getDashboardStats(query);
  }
}
