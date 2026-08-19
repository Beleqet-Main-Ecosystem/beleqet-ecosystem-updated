import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { DisputeManagerService } from './dispute-manager.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputeQueryDto } from './dto/dispute-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Handles dispute-related API routes.
 */
@Controller('dispute')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisputeManagerController {
  constructor(private readonly disputeManagerService: DisputeManagerService) {}

  /**
   * Creates a new dispute for a contract.
   */
  @Post()
  @Roles('FREELANCER', 'EMPLOYER')
  @RequirePermissions('manage:disputes')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    createDisputeDto: CreateDisputeDto,
  ) {
    return this.disputeManagerService.createDispute(user.userId, createDisputeDto);
  }

  /**
   * Lists disputes for admin review.
   */
  @Get()
  @Roles('ADMIN')
  @RequirePermissions('manage:disputes')
  async findAll(
    @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    query: DisputeQueryDto,
  ) {
    return this.disputeManagerService.getAllDisputes(query);
  }

  /**
   * Resolves an open dispute as an admin.
   */
  @Patch(':id/resolve')
  @Roles('ADMIN')
  @RequirePermissions('manage:disputes')
  async resolve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() admin: CurrentUserPayload,
    @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
    resolveDto: ResolveDisputeDto,
  ) {
    return this.disputeManagerService.resolveDispute(id, admin.userId, resolveDto);
  }
}
