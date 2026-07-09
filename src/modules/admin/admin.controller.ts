import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength, IsArray } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { adminAnnouncementEmail } from '../notifications/email-templates';
import { ChatService } from '../chat/chat.service';

enum ManagedRole {
  JOB_SEEKER = 'JOB_SEEKER',
  EMPLOYER = 'EMPLOYER',
  FREELANCER = 'FREELANCER',
  ADMIN = 'ADMIN',
}
class CreateUserDto {
  @IsEmail() email: string;
  @IsString() @MinLength(2) firstName: string;
  @IsString() @MinLength(2) lastName: string;
  @IsString() @MinLength(8) password: string;
  @IsEnum(ManagedRole) role: ManagedRole;
}
class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) firstName?: string;
  @IsOptional() @IsString() @MinLength(2) lastName?: string;
  @IsOptional() @IsEnum(ManagedRole) role?: ManagedRole;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class BroadcastDto {
  @IsString() @MinLength(3) title: string;
  @IsString() @MinLength(5) body: string;
  @IsOptional() @IsEnum(ManagedRole) role?: ManagedRole;
  @IsOptional() @IsArray() @IsString({ each: true }) userIds?: string[];
}
class ResolveDisputeDto {
  @IsString() @MinLength(10) resolution: string;
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
          })
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
      where: { contractId: dispute.contractId }
    });

    if (chatRoom) {
      chatHistory = await this.prisma.message.findMany({
        where: { roomId: chatRoom.id },
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: safeUserSelect } }
      });
    }

    return { dispute, chatHistory };
  }

  @Get('compliance/gdpr/export/:userId')
  @ApiOperation({ summary: 'Export user data for GDPR compliance' })
  async exportUserData(@Param('userId') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: true,
        applications: true,
        bids: true,
        freelanceJobs: true,
        contractsAsClient: true,
        contractsAsFreelancer: true,
      },
    });

    const twoFactor = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
      select: { enabled: true },
    });

    return {
      data: {
        ...user,
        twoFactor: twoFactor ? { enabled: twoFactor.enabled } : null,
      },
    };
  }
}
