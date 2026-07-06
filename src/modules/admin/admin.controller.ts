import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
 
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength, IsArray, IsInt, Min } from 'class-validator';
 
import * as bcrypt from 'bcryptjs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { adminAnnouncementEmail } from '../notifications/email-templates';
import { ChatService } from '../chat/chat.service';
import { FraudAlertService } from '../fraud-alert/fraud-alert.service';
import { Type } from 'class-transformer';

enum ManagedRole {
  JOB_SEEKER = 'JOB_SEEKER',
  EMPLOYER = 'EMPLOYER',
  FREELANCER = 'FREELANCER',
  ADMIN = 'ADMIN',
}
class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) firstName!: string;
  @IsString() @MinLength(2) lastName!: string;
  @IsString() @MinLength(8) password!: string;
  @IsEnum(ManagedRole) role!: ManagedRole;
}
class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) firstName?: string;
  @IsOptional() @IsString() @MinLength(2) lastName?: string;
  @IsOptional() @IsEnum(ManagedRole) role?: ManagedRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class BroadcastDto {
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(5) body!: string;
  @IsOptional() @IsEnum(ManagedRole) role?: ManagedRole;
  @IsOptional() @IsArray() @IsString({ each: true }) userIds?: string[];
}
class ResolveDisputeDto {
  @IsString() @MinLength(10) resolution!: string;
}

class QueryFraudAlertsDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() ruleType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
}

class ResolveFraudAlertDto {
  @IsEnum(['RESOLVED', 'FALSE_POSITIVE', 'CONFIRMED']) status: 'RESOLVED' | 'FALSE_POSITIVE' | 'CONFIRMED';
  @IsOptional() @IsString() @MinLength(5) resolutionNote?: string;
}

class CreateFraudRuleDto {
  @IsString() @MinLength(3) name: string;
  @IsEnum(['OFF_PLATFORM_PAYMENT', 'FAKE_PROFILE', 'PAYMENT_ANOMALY', 'DUPLICATE_LISTING'])
  ruleType: 'OFF_PLATFORM_PAYMENT' | 'FAKE_PROFILE' | 'PAYMENT_ANOMALY' | 'DUPLICATE_LISTING';
  @IsOptional() @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) severity?: string = 'MEDIUM';
  @IsOptional() @IsBoolean() enabled?: boolean = true;
  @IsOptional() config?: Record<string, unknown>;
  @IsString() i18nKey: string;
}

class UpdateFraudRuleDto {
  @IsOptional() @IsString() @MinLength(3) name?: string;
  @IsOptional() @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) severity?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() config?: Record<string, unknown>;
  @IsOptional() @IsString() i18nKey?: string;
}

const safeUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  emailVerified: true,
  createdAt: true,
} as const;

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly fraudAlertService: FraudAlertService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  getUsers() {
    return this.prisma.user.findMany({ select: safeUserSelect, orderBy: { createdAt: 'desc' } });
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a user' })
  async createUser(@Body() dto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash: await bcrypt.hash(dto.password, 12),
        role: dto.role,
      },
      select: safeUserSelect,
    });
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update a user' })
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data: dto, select: safeUserSelect });
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user without dependent records' })
  async deleteUser(@Param('id') id: string, @CurrentUser() admin: CurrentUserPayload) {
    if (id === admin.userId)
      return { deleted: false, reason: 'You cannot delete your own admin account' };
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }

  @Get('contacts')
  getContacts() {
    return this.prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Patch('contacts/:id/status')
  updateContact(@Param('id') id: string, @Body() body: { status: 'NEW' | 'READ' | 'RESOLVED' }) {
    return this.prisma.contactMessage.update({ where: { id }, data: { status: body.status } });
  }

  @Post('notifications/broadcast')
  async broadcast(@Body() dto: BroadcastDto) {
    let users;
    if (dto.userIds && dto.userIds.length > 0) {
      users = await this.prisma.user.findMany({
        where: { id: { in: dto.userIds }, isActive: true },
        select: { id: true, email: true, firstName: true },
      });
    } else {
      users = await this.prisma.user.findMany({
        where: { isActive: true, ...(dto.role && { role: dto.role }) },
        select: { id: true, email: true, firstName: true },
      });
    }

    if (users.length === 0) {
      return { delivered: 0 };
    }

    const result = await this.prisma.notification.createMany({
      data: users.map((user: any) => ({
        userId: user.id,
        channel: 'IN_APP',
        type: 'ADMIN_ANNOUNCEMENT',
        title: dto.title,
        body: dto.body,
      })),
    });

    // Enqueue emails
    for (const u of users) {
      adminAnnouncementEmail(u.firstName, dto.title, dto.body)
        .then((email) =>
          this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
            to: u.email,
            subject: dto.title,
            ...email,
          }),
        )
        .catch(() => {});
    }

    return { delivered: result.count };
  }

  @Get('escrow/disputes')
  getDisputes() {
    return this.prisma.dispute.findMany({
      include: { contract: { include: { freelanceJob: true, client: true, freelancer: true } } },
    });
  }

  @Patch('disputes/:id/resolve')
  resolveDispute(@Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.prisma.dispute.update({
      where: { id },
      data: { resolution: dto.resolution, resolvedAt: new Date() },
    });
  }

  @Get('disputes/:id/arbitration')
  @ApiOperation({ summary: 'Get dispute details including chat history for arbitration' })
  async getArbitrationDetails(@Param('id') id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            freelanceJob: true,
            client: { select: safeUserSelect },
            freelancer: { select: safeUserSelect },
          },
        },
      },
    });

    if (!dispute) return null;

    let chatHistory: any[] = [];
    const chatRoom = await this.prisma.chatRoom.findUnique({
      where: { contractId: dispute.contractId },
    });

    if (chatRoom) {
      chatHistory = await this.prisma.message.findMany({
        where: { roomId: chatRoom.id },
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: safeUserSelect } },
      });
    }

    return { dispute, chatHistory };
  }

  @Get('compliance/gdpr/export/:userId')
  @ApiOperation({ summary: 'Export user data for GDPR compliance' })
  async exportUserData(@Param('userId') userId: string, @CurrentUser() admin: CurrentUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        applications: true,
        bids: true,
        freelanceJobs: true,
        contractsAsClient: true,
        contractsAsFreelancer: true,
        kycVerification: true,
 
        subscriptions: { include: { transactions: true } },
 
        fraudAlerts: true,
 
      },
    });

    const twoFactor = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
      select: { enabled: true },
    });

    await this.prisma.eventLog.create({
      data: {
        eventType: 'gdpr.export.user_data',
        entityId: userId,
        entityType: 'User',
        payload: {
          exportedBy: admin.userId,
          timestamp: new Date().toISOString(),
        } as never,
        processedBy: AdminController.name,
      },
    });

    return {
      data: {
        ...user,
        twoFactor: twoFactor ? { enabled: twoFactor.enabled } : null,
      },
    };
  }
 
 

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

    if (!alert) return null;

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
  async exportFraudAlertData(@Param('userId') userId: string, @CurrentUser() admin: CurrentUserPayload) {
    return this.fraudAlertService.gdprExport(userId, admin.userId);
  }

  @Delete('fraud/alerts/gdpr/delete/:userId')
  @ApiOperation({ summary: 'Soft-delete fraud alerts for GDPR right-to-erasure' })
  async deleteFraudAlertData(@Param('userId') userId: string, @CurrentUser() admin: CurrentUserPayload) {
    return this.fraudAlertService.gdprDelete(userId, admin.userId);
  }
 
}
