import {
  Controller,
  Get,
  Header,
  Query,
  StreamableFile,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AdminStatsService } from './admin-stats.service';
import { StatsQueryDto } from './dto/stats-query.dto';
import {
  OverviewResponse,
  PlatformStats,
  ProjectBreakdownResponse,
  RevenueChartResponse,
  UserGrowthChartResponse,
} from './types/admin-stats.types';

const queryPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

/**
 * Admin Stats HTTP surface. Every route requires JWT + ADMIN + view:stats.
 * Non-admins receive a generic 403 (no dashboard existence leak).
 */
@ApiTags('admin-stats')
@ApiBearerAuth()
@Controller('admin-stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@RequirePermissions('view:stats')
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Dashboard overview summary cards' })
  getOverview(@Query(queryPipe) query: StatsQueryDto): Promise<OverviewResponse> {
    return this.adminStatsService.getOverview(query);
  }

  @Get('charts/revenue')
  @ApiOperation({ summary: 'Revenue time series (zero-filled)' })
  getRevenueChart(@Query(queryPipe) query: StatsQueryDto): Promise<RevenueChartResponse> {
    return this.adminStatsService.getRevenueChart(query);
  }

  @Get('charts/users')
  @ApiOperation({ summary: 'User growth time series (zero-filled)' })
  getUserGrowthChart(@Query(queryPipe) query: StatsQueryDto): Promise<UserGrowthChartResponse> {
    return this.adminStatsService.getUserGrowthChart(query);
  }

  @Get('projects/breakdown')
  @ApiOperation({ summary: 'Project status summary and recent projects' })
  getProjectBreakdown(@Query(queryPipe) query: StatsQueryDto): Promise<ProjectBreakdownResponse> {
    return this.adminStatsService.getProjectBreakdown(query);
  }

  @Get('overview/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export overview cards as CSV' })
  async exportOverview(@Query(queryPipe) query: StatsQueryDto): Promise<StreamableFile> {
    const data = await this.adminStatsService.getOverview(query);
    return this.csvFile(
      this.adminStatsService.exportOverviewCsv(data),
      `admin-stats-overview-${data.range.from}_${data.range.to}.csv`,
    );
  }

  @Get('charts/revenue/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export revenue series as CSV' })
  async exportRevenue(@Query(queryPipe) query: StatsQueryDto): Promise<StreamableFile> {
    const data = await this.adminStatsService.getRevenueChart(query);
    return this.csvFile(
      this.adminStatsService.exportRevenueCsv(data),
      `admin-stats-revenue-${data.range.from}_${data.range.to}.csv`,
    );
  }

  @Get('charts/users/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export user growth series as CSV' })
  async exportUsers(@Query(queryPipe) query: StatsQueryDto): Promise<StreamableFile> {
    const data = await this.adminStatsService.getUserGrowthChart(query);
    return this.csvFile(
      this.adminStatsService.exportUsersCsv(data),
      `admin-stats-users-${data.range.from}_${data.range.to}.csv`,
    );
  }

  @Get('projects/status/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export project status summary as CSV' })
  async exportStatus(@Query(queryPipe) query: StatsQueryDto): Promise<StreamableFile> {
    const data = await this.adminStatsService.getProjectBreakdown(query);
    return this.csvFile(
      this.adminStatsService.exportStatusCsv(data),
      `admin-stats-project-status-${data.range.from}_${data.range.to}.csv`,
    );
  }

  @Get('projects/recent/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Export recent projects as CSV' })
  async exportRecent(@Query(queryPipe) query: StatsQueryDto): Promise<StreamableFile> {
    const data = await this.adminStatsService.getProjectBreakdown(query);
    return this.csvFile(
      this.adminStatsService.exportRecentProjectsCsv(data),
      `admin-stats-projects-recent-${data.range.from}_${data.range.to}.csv`,
    );
  }

  /** @deprecated Use /admin-stats/overview */
  @Get('dashboard')
  @ApiOperation({ summary: 'Legacy flat dashboard stats (deprecated)' })
  getDashboard(@Query(queryPipe) query: StatsQueryDto): Promise<PlatformStats> {
    return this.adminStatsService.getDashboardStats(query);
  }

  private csvFile(body: string, filename: string): StreamableFile {
    return new StreamableFile(Buffer.from(body, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
