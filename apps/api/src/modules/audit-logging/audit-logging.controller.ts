import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Res,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLoggingService } from './audit-logging.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { AuditLogListResponse, AuditLogRecord } from './interfaces/audit-log.interface';

/**
 * Admin REST API for querying, inspecting, and exporting audit logs.
 */
@ApiTags('admin-audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/audit-logs')
export class AuditLoggingController {
  constructor(private readonly auditLoggingService: AuditLoggingService) {}

  /**
   * Lists audit logs with filters, search, and pagination.
   *
   * @param query - Filter / locale / currency options
   * @returns Paginated audit log list
   */
  @Get()
  @ApiOperation({ summary: 'List audit logs with filters and search' })
  async list(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: QueryAuditLogsDto,
  ): Promise<AuditLogListResponse> {
    return this.auditLoggingService.findMany(query);
  }

  /**
   * Exports filtered audit logs as JSON or CSV.
   * Declared before `:id` so `export` is not captured as an id param.
   *
   * @param query - Filter options including `format`
   * @param res - Express response for attachment headers
   */
  @Get('export')
  @ApiOperation({ summary: 'Export filtered audit logs (JSON or CSV)' })
  async export(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: QueryAuditLogsDto,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.auditLoggingService.export(query);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.body);
  }

  /**
   * Returns a single audit log by id.
   *
   * @param id - EventLog UUID
   * @param query - Optional lang / currency
   * @returns Audit log record
   */
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get a single audit log by id' })
  async getById(
    @Param('id') id: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: QueryAuditLogsDto,
  ): Promise<AuditLogRecord> {
    return this.auditLoggingService.findById(id, query.lang || 'en', query.currency || 'ETB');
  }
}
