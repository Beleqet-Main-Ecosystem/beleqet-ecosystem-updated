import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { FraudAlertService } from './fraud-alert.service';
import { QueryFraudAlertsDto } from './dto/query-fraud-alerts.dto';
import { ResolveFraudAlertDto } from './dto/resolve-fraud-alert.dto';
import { CreateFraudRuleDto, UpdateFraudRuleDto } from './dto/create-fraud-rule.dto';

/** The user fields an admin may see next to an alert (as the admin API returns them). */
const safeUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  kycVerified: true,
  emailVerified: true,
  createdAt: true,
  twoFactor: { select: { enabled: true } },
} as const;

/**
 * The admin's fraud-alert endpoints (/admin/fraud/...). They lived in AdminController; they belong
 * to this module, so they come and go with it.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class FraudAlertAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fraudAlertService: FraudAlertService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────
  //  Fraud Alert Management
  // ────────────────────────────────────────────────────────────────────────

  @Get('fraud/alerts')
  @ApiOperation({ summary: 'List fraud alerts with pagination and filters' })
  async getFraudAlerts(@Query() query: QueryFraudAlertsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.ruleType) where.ruleType = query.ruleType;

    const [alerts, total] = await Promise.all([
      this.prisma.fraudAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: safeUserSelect },
          resolvedBy: { select: safeUserSelect },
          rule: { select: { id: true, name: true, ruleType: true } },
        },
      }),
      this.prisma.fraudAlert.count({ where }),
    ]);

    return {
      data: alerts,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  @Get('fraud/alerts/:id')
  @ApiOperation({ summary: 'Get fraud alert detail with full evidence and context' })
  async getFraudAlert(@Param('id') id: string) {
    const alert = await this.prisma.fraudAlert.findUnique({
      where: { id },
      include: {
        user: { select: safeUserSelect },
        resolvedBy: { select: safeUserSelect },
        rule: true,
      },
    });

    if (!alert) throw new NotFoundException(`Fraud alert ${id} not found`);

    const context: Record<string, unknown> = {};

    if (alert.entityType === 'Message' && alert.entityId) {
      const message = await this.prisma.message.findUnique({
        where: { id: alert.entityId },
        include: {
          room: { include: { participants: { include: { user: { select: safeUserSelect } } } } },
          sender: { select: safeUserSelect },
        },
      });
      context.message = message;
    }

    if ((alert.entityType === 'User' || alert.entityType === 'WalletTransaction') && alert.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: alert.userId },
        select: safeUserSelect,
      });
      context.user = user;
    }

    if (alert.entityType === 'Job' && alert.entityId) {
      const job = await this.prisma.job.findUnique({
        where: { id: alert.entityId },
      });
      context.job = job;
    }

    return { alert, context };
  }

  @Patch('fraud/alerts/:id')
  @ApiOperation({ summary: 'Resolve a fraud alert' })
  async resolveFraudAlert(
    @Param('id') id: string,
    @Body() dto: ResolveFraudAlertDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    await this.fraudAlertService.resolveAlert(id, dto.status, admin.userId, dto.resolutionNote);

    const updated = await this.prisma.fraudAlert.findUnique({
      where: { id },
      include: { user: { select: safeUserSelect } },
    });

    return { resolved: true, alert: updated };
  }

  // ───── Fraud Rules CRUD ─────────────────────────────────────────────────

  @Get('fraud/rules')
  @ApiOperation({ summary: 'List all fraud detection rules' })
  getFraudRules() {
    return this.prisma.fraudRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Post('fraud/rules')
  @ApiOperation({ summary: 'Create a new fraud detection rule' })
  createFraudRule(@Body() dto: CreateFraudRuleDto) {
    return this.prisma.fraudRule.create({
      data: {
        name: dto.name,
        ruleType: dto.ruleType,
        severity: dto.severity as never,
        enabled: dto.enabled,
        config: dto.config as never,
        i18nKey: dto.i18nKey,
      },
    });
  }

  @Patch('fraud/rules/:id')
  @ApiOperation({ summary: 'Update a fraud detection rule' })
  updateFraudRule(@Param('id') id: string, @Body() dto: UpdateFraudRuleDto) {
    return this.prisma.fraudRule.update({ where: { id }, data: dto as never });
  }

  @Get('fraud/alerts/gdpr/export/:userId')
  @ApiOperation({ summary: 'Export fraud alert data for GDPR compliance' })
  async exportFraudAlertData(
    @Param('userId') userId: string,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.fraudAlertService.gdprExport(userId, admin.userId);
  }

  @Delete('fraud/alerts/gdpr/delete/:userId')
  @ApiOperation({ summary: 'Soft-delete fraud alerts for GDPR right-to-erasure' })
  async deleteFraudAlertData(
    @Param('userId') userId: string,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.fraudAlertService.gdprDelete(userId, admin.userId);
  }
}
