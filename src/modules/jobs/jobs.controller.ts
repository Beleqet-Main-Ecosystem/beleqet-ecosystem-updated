import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { CreateJobDto, QueryJobsDto } from './dto/create-job.dto';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly svc: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'Search & browse job listings (public)' })
  findAll(@Query() query: QueryJobsDto, @I18nLang() locale: string) {
    return this.svc.findAll(query, locale);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER', 'ADMIN')
  @ApiBearerAuth()
  myJobs(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.findByCompany(user.userId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all job categories' })
  getCategories(@I18nLang() locale: string) {
    return this.svc.getCategories(locale);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @I18nLang() locale: string) {
    return this.svc.findOne(id, locale);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a job listing (employer only)' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateJobDto) {
    return this.svc.create(user.userId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER', 'ADMIN')
  @ApiBearerAuth()
  update(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload, @Body() dto: Partial<CreateJobDto>) {
    return this.svc.update(id, user.userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EMPLOYER', 'ADMIN')
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.svc.remove(id, user.userId);
  }
}
