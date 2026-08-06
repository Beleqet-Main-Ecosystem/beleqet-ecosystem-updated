import { Body, Controller, Get, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { DisputeManagerService } from './dispute-manager.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * Handles dispute-related API routes.
 */
@Controller('dispute')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisputeManagerController {
  constructor(private readonly disputeManagerService: DisputeManagerService) { }

  /**
   * Creates a new dispute for a contract.
   */
  @Post()
  @Roles('FREELANCER', 'EMPLOYER')
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ValidationPipe({ transform: true })) createDisputeDto: CreateDisputeDto,
  ) {
    return this.disputeManagerService.createDispute(user.userId, createDisputeDto);
  }

  /**
   * Lists disputes for admin review.
   */
  @Get()
  @Roles('ADMIN')
  async findAll() {
    return this.disputeManagerService.getAllDisputes();
  }

  /**
   * Resolves an open dispute as an admin.
   */
  @Patch(':id/resolve')
  @Roles('ADMIN')
  async resolve(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true })) resolveDto: ResolveDisputeDto,
  ) {
    return this.disputeManagerService.resolveDispute(id, resolveDto);
  }
}
