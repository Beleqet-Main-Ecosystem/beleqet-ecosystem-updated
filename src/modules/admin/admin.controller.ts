import {
  BadRequestException,
  Body,
  ConflictException,
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
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  IsArray,
  IsIn,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import { JobStatus, FreelanceJobStatus, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { DisputeManagerService } from '../dispute-manager/dispute-manager.service';
import { ResolveDisputeDto } from '../dispute-manager/dto/resolve-dispute.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService } from '../chat/chat.service';
import { FraudAlertService } from '../fraud-alert/fraud-alert.service';
import { QueryFraudAlertsDto } from '../fraud-alert/dto/query-fraud-alerts.dto';
import { ResolveFraudAlertDto } from '../fraud-alert/dto/resolve-fraud-alert.dto';
import { CreateFraudRuleDto, UpdateFraudRuleDto } from '../fraud-alert/dto/create-fraud-rule.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditLoggingService } from '../audit-logging/audit-logging.service';
import {
  assertAccountChangeAllowed,
  assertGigModeration,
  assertJobModeration,
  assertRemovalAllowed,
} from './admin-rules';

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
  @IsOptional() @IsBoolean() kycVerified?: boolean;
}
class ListUsersQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 25;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(ManagedRole) role?: ManagedRole;
  @IsOptional() @IsIn(['active', 'suspended']) status?: 'active' | 'suspended';
}
class UpdateJobModerationStatusDto {
  @IsEnum(JobStatus) status!: JobStatus;
}
class UpdateGigModerationStatusDto {
  @IsEnum(FreelanceJobStatus) status!: FreelanceJobStatus;
}
class BroadcastDto {
  @IsString() @MinLength(3) title!: string;
  @IsString() @MinLength(5) body!: string;
  @IsOptional() @IsEnum(ManagedRole) role?: ManagedRole;
  @IsOptional() @IsArray() @IsString({ each: true }) userIds?: string[];
}
class VerificationDecisionDto {
  @IsIn(['VERIFIED', 'REJECTED']) decision!: 'VERIFIED' | 'REJECTED';
  @IsOptional() @IsString() note?: string;
}

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
    private readonly notificationsService: NotificationsService,
    private readonly auditLoggingService: AuditLoggingService,
    private readonly disputes: DisputeManagerService,
  ) {}

  @RequirePermissions('manage:users')
  @Get('users')
  @ApiOperation({ summary: 'List users a page at a time, with search and filters' })
  async getUsers(@Query() query: ListUsersQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { isActive: query.status === 'active' } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data: users.map((u) => ({ ...u, twoFactorEnabled: u.twoFactor?.enabled ?? false })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  @RequirePermissions('manage:users')
  @Post('users')
  @ApiOperation({ summary: 'Create a user' })
  async createUser(@Body() dto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        passwordHash: await bcrypt.hash(dto.password, 12),
        role: dto.role,
      },
      select: safeUserSelect,
    });
    return {
      ...user,
      twoFactorEnabled: user.twoFactor?.enabled ?? false,
    };
  }

  @RequirePermissions('manage:users')
  @Patch('users/:id')
  @ApiOperation({ summary: 'Update a user (role, isActive ban/activate, kyc)' })
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    const target = await this.findAccount(id);
    assertAccountChangeAllowed(admin.userId, target, dto, await this.activeAdminCount());
    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: safeUserSelect,
    });
    return {
      ...user,
      twoFactorEnabled: user.twoFactor?.enabled ?? false,
    };
  }

  @RequirePermissions('manage:jobs')
  @Get('moderation/items')
  @ApiOperation({ summary: 'List public postings (jobs and gigs) for moderation queue' })
  async getModerationItems(
    @Query('type') type?: 'ALL' | 'JOB' | 'GIG',
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const selectedType = type || 'ALL';
    const items: Array<{
      id: string;
      type: 'JOB' | 'GIG';
      title: string;
      description: string;
      creatorName: string;
      creatorEmail?: string;
      category?: string;
      location?: string;
      compensation: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    if (selectedType === 'ALL' || selectedType === 'JOB') {
      const jobs = await this.prisma.job.findMany({
        include: { company: true, category: true },
        orderBy: { createdAt: 'desc' },
      });
      for (const job of jobs) {
        items.push({
          id: job.id,
          type: 'JOB',
          title: job.title,
          description: job.description,
          creatorName: job.company?.name || job.companyName || 'Independent Employer',
          creatorEmail: job.applyEmail || undefined,
          category: job.category?.label,
          location: job.location,
          compensation: job.salaryMin
            ? `${job.salaryMin.toLocaleString()} - ${job.salaryMax?.toLocaleString() ?? job.salaryMin.toLocaleString()} ${job.currency || 'ETB'}`
            : 'Negotiable',
          status: job.status,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        });
      }
    }

    if (selectedType === 'ALL' || selectedType === 'GIG') {
      const gigs = await this.prisma.freelanceJob.findMany({
        include: {
          client: { select: { id: true, firstName: true, lastName: true, email: true } },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      for (const gig of gigs) {
        items.push({
          id: gig.id,
          type: 'GIG',
          title: gig.title,
          description: gig.description,
          creatorName: gig.client
            ? `${gig.client.firstName} ${gig.client.lastName}`.trim()
            : 'Client',
          creatorEmail: gig.client?.email,
          category: gig.category?.label,
          location: gig.locationPreference || 'Remote',
          compensation: gig.budgetMin
            ? `${gig.budgetMin.toLocaleString()} - ${gig.budgetMax.toLocaleString()} ${gig.currency || 'ETB'}`
            : `${gig.budgetMax.toLocaleString()} ${gig.currency || 'ETB'}`,
          status: gig.status,
          createdAt: gig.createdAt,
          updatedAt: gig.updatedAt,
        });
      }
    }

    let filtered = items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (status && status !== 'ALL') {
      filtered = filtered.filter((i) => i.status.toUpperCase() === status.toUpperCase());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.creatorName.toLowerCase().includes(q) ||
          (i.category && i.category.toLowerCase().includes(q)) ||
          (i.location && i.location.toLowerCase().includes(q)),
      );
    }

    return filtered;
  }

  @Get('companies/verification')
  @ApiOperation({ summary: 'Companies waiting for their trade licence to be checked' })
  companiesToVerify(@Query('status') status?: string) {
    const wanted = ['PENDING', 'VERIFIED', 'REJECTED'].includes(status ?? '') ? status : 'PENDING';
    return this.prisma.company.findMany({
      where: { verificationStatus: wanted as 'PENDING' | 'VERIFIED' | 'REJECTED' },
      orderBy: { verificationRequestedAt: 'asc' },
      select: {
        id: true,
        name: true,
        website: true,
        industry: true,
        location: true,
        tradeLicenseUrl: true,
        verificationStatus: true,
        verificationRequestedAt: true,
        verificationNote: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  /** Approve or reject a trade licence; a rejection says why so the employer can fix it. */
  @Patch('companies/:id/verification')
  async decideVerification(@Param('id') id: string, @Body() dto: VerificationDecisionDto) {
    if (dto.decision === 'REJECTED' && !dto.note?.trim()) {
      throw new BadRequestException('Say why the licence was rejected');
    }
    const { count } = await this.prisma.company.updateMany({
      where: { id, verificationStatus: 'PENDING' },
      data: {
        verificationStatus: dto.decision,
        verified: dto.decision === 'VERIFIED',
        verificationNote: dto.note?.trim() || null,
      },
    });
    if (count === 0) throw new NotFoundException('No licence waiting for review for this company');
    return { verificationStatus: dto.decision };
  }

  @RequirePermissions('manage:jobs')
  @Patch('moderation/jobs/:id/status')
  @ApiOperation({ summary: 'Approve, archive, or update job status' })
  async updateJobStatus(@Param('id') id: string, @Body() dto: UpdateJobModerationStatusDto) {
    const current = await this.prisma.job.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw new NotFoundException('Job not found');
    assertJobModeration(current.status, dto.status);
    const job = await this.prisma.job.update({
      where: { id },
      data: { status: dto.status },
      include: { company: true, category: true },
    });
    return job;
  }

  @RequirePermissions('manage:jobs')
  @Patch('moderation/gigs/:id/status')
  @ApiOperation({ summary: 'Approve, cancel, or update freelance gig status' })
  async updateGigStatus(@Param('id') id: string, @Body() dto: UpdateGigModerationStatusDto) {
    const current = await this.prisma.freelanceJob.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) throw new NotFoundException('Project not found');
    assertGigModeration(current.status, dto.status);
    const gig = await this.prisma.freelanceJob.update({
      where: { id },
      data: { status: dto.status },
      include: { client: { select: safeUserSelect }, category: true },
    });
    return gig;
  }

  @RequirePermissions('manage:users')
  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user without dependent records' })
  async deleteUser(@Param('id') id: string, @CurrentUser() admin: CurrentUserPayload) {
    assertRemovalAllowed(admin.userId, await this.findAccount(id), await this.activeAdminCount());
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      // Applications, payments, messages and contracts point at the account; keep them intact.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          'This account has activity on the platform, so it can’t be deleted. Suspend it, or erase its personal data.',
        );
      }
      throw error;
    }
    return { deleted: true };
  }

  private async findAccount(id: string) {
    const account = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true },
    });
    if (!account) throw new NotFoundException('User not found');
    return account;
  }

  private activeAdminCount() {
    return this.prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
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
    const delivered = await this.notificationsService.sendSystemAlert(
      'ADMIN_ANNOUNCEMENT',
      dto.body,
      { title: dto.title, userIds: dto.userIds, role: dto.role },
    );
    return { delivered };
  }

  @Get('escrow/disputes')
  getDisputes() {
    return this.prisma.dispute.findMany({
      // Names and emails only: full user rows would send password hashes to the browser.
      include: {
        contract: {
          include: {
            freelanceJob: { select: { id: true, title: true } },
            client: { select: { id: true, firstName: true, lastName: true, email: true } },
            freelancer: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Same settlement as PATCH /dispute/:id/resolve: recording a decision without moving the money left escrow stuck.
  @Patch('disputes/:id/resolve')
  resolveDispute(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.disputes.resolveDispute(id, dto, user.userId);
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

    void this.auditLoggingService.createSafe({
      eventType: 'gdpr.export.user_data',
      entityId: userId,
      entityType: 'User',
      payload: {
        exportedBy: admin.userId,
        timestamp: new Date().toISOString(),
      },
      processedBy: AdminController.name,
      actorUserId: admin.userId,
    });
    const auditLogs = await this.auditLoggingService.findByUserForGdpr(userId);

    return {
      data: {
        ...user,
        twoFactor: twoFactor ? { enabled: twoFactor.enabled } : null,
        auditLogs,
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
