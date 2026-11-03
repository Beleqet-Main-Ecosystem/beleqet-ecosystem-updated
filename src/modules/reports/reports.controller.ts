import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ReportStatus, ReportTarget } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { REPORT_REASONS, ReportReason, ReportsService } from './reports.service';

class CreateReportDto {
  @IsEnum(ReportTarget) targetType: ReportTarget;
  @IsString() targetId: string;
  @IsIn(REPORT_REASONS) reason: ReportReason;
  @IsOptional() @IsString() @MaxLength(1000) details?: string;
}

class ResolveReportDto {
  @IsIn(['dismiss', 'remove']) action: 'dismiss' | 'remove';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Report a job or forum post' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateReportDto) {
    return this.reports.create(user.userId, dto);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reports to review' })
  list(@Query('status') status?: string) {
    const known = (Object.values(ReportStatus) as string[]).includes(status ?? '');
    return this.reports.list(known ? (status as ReportStatus) : 'OPEN');
  }

  @Patch('admin/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Dismiss a report, or remove what was reported' })
  resolve(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reports.resolve(id, user.userId, dto);
  }
}
