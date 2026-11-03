import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JobType } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JobAlertsService } from './job-alerts.service';

class JobAlertDto {
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(60, { each: true }) keywords?: string[];
  @IsOptional() @IsString() @MaxLength(80) location?: string | null;
  @IsOptional() @IsEnum(JobType) jobType?: JobType | null;
  @IsOptional() @IsInt() @Min(0) minSalary?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('job-alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('job-alerts')
export class JobAlertsController {
  constructor(private readonly alerts: JobAlertsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.alerts.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: JobAlertDto) {
    return this.alerts.create(user.userId, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: JobAlertDto) {
    return this.alerts.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.alerts.remove(user.userId, id);
  }
}
