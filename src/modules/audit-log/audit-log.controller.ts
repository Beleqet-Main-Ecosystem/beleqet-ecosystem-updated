import { Controller, Get, Delete, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

/**
 * RESTful Controller managing Audit Log retrieval, filtering, and data retention operations.
 */
@ApiTags('Audit Logs')
@Controller('api/v1/audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Fetches paginated system audit logs.
   *
   * @param query - Pagination parameters (page, limit)
   * @returns Paginated audit log response object
   */
  @Get()
  @ApiOperation({ summary: 'Fetch audit logs with server-side pagination' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getAuditLogs(@Query() query: QueryAuditLogDto) {
    return this.auditLogService.findAll(query);
  }

  /**
   * Searches audit logs by user ID, action type, target entity, and date range.
   *
   * @param query - Search parameters (userId, action, entity, startDate, endDate, page, limit)
   * @returns Filtered audit log response object
   */
  @Get('search')
  @ApiOperation({ summary: 'Search audit logs by userId, action, entity, and date range' })
  @ApiResponse({ status: 200, description: 'Filtered audit logs retrieved successfully' })
  async searchAuditLogs(@Query() query: QueryAuditLogDto) {
    return this.auditLogService.searchLogs(query);
  }

  /**
   * Triggers manual GDPR data retention cleanup of audit logs older than target retention window.
   *
   * @param days - Optional retention days override (defaults to configured retention policy)
   * @returns Purge operation result summary
   */
  @Delete('retention')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger GDPR audit log retention cleanup' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Retention window in days' })
  @ApiResponse({ status: 200, description: 'Audit log retention cleanup completed' })
  async triggerRetentionCleanup(@Query('days') days?: number) {
    return this.auditLogService.purgeExpiredLogs(days ? Number(days) : undefined);
  }
}
