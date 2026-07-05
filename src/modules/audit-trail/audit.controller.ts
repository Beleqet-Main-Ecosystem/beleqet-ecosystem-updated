import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Controller('audit-trail')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** Returns a paginated list of audit log records matching the supplied filters. */
  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.auditService.query(query);
  }

  /** Returns aggregate counts of audit log entries grouped by action type for a date range. */
  @Get('stats')
  async stats(@Query('fromDate') fromDate: string, @Query('toDate') toDate: string) {
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();
    return this.auditService.getStats(from, to);
  }

  /** Exports filtered audit logs as a CSV file, capped at 10 000 records. */
  @Get('export')
  async export(@Query() query: AuditQueryDto, @Res() res: Response) {
    const [csv, total] = await Promise.all([
      this.auditService.exportCsv(query),
      this.auditService.countExport(query),
    ]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    if (total > this.auditService.exportMaxRows) {
      res.setHeader('X-Truncated', 'true');
    }
    res.send(csv);
  }

  /** Returns full detail of a single audit log entry including integrity verification status. */
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
