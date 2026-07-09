import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';
import { InterviewPlannerService } from './interview-planner.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AutoScheduleInterviewDto } from './dto/auto-schedule-interview.dto';
@ApiTags('Interview Planner')
@ApiBearerAuth()
@Controller('interview-planner')
/**
 * Provides endpoints for managing interview availability,
 * finding common availability, and automatically scheduling interviews.
 */
export class InterviewPlannerController {
  constructor(private readonly interviewPlannerService: InterviewPlannerService) {}
  /**
   * Creates a new availability slot for the authenticated user.
   *
   * @param req Authenticated request
   * @param dto Availability details
   * @returns Newly created availability slot
   */
  @ApiOperation({
    summary: 'Create user availability slot',
  })
  @UseGuards(JwtAuthGuard)
  @Post('availability')
  createAvailability(
    @Request() req: Express.Request & { user: { userId: string } },
    @Body() dto: CreateAvailabilityDto,
  ) {
    return this.interviewPlannerService.createAvailability(req.user.userId, dto);
  }
  /**
   * Retrieves all availability slots
   * for the authenticated user.
   *
   * @param req Authenticated request
   * @returns User availability slots
   */
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current user availability slots',
  })
  @Get('availability')
  getAvailability(
    @Request()
    req: Express.Request & {
      user: { userId: string };
    },
  ) {
    return this.interviewPlannerService.getUserAvailabilities(req.user.userId);
  }
  /**
   * Updates one of the authenticated user's interview availability slots.
   *
   * Only the owner of the availability slot can modify it.
   *
   * @param req Authenticated request containing the current user.
   * @param id Availability slot identifier.
   * @param dto Updated availability details.
   * @returns Updated availability slot.
   */
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update an availability slot',
  })
  @Patch('availability/:id')
  updateAvailability(
    @Request()
    req: Express.Request & {
      user: { userId: string };
    },
    @Param('id') id: string,
    @Body() dto: CreateAvailabilityDto,
  ) {
    return this.interviewPlannerService.updateAvailability(req.user.userId, id, dto);
  }

  /**
   * Deletes one of the authenticated user's interview availability slots.
   *
   * Only the owner of the availability slot can remove it.
   *
   * @param req Authenticated request containing the current user.
   * @param id Availability slot identifier.
   * @returns Confirmation of the deleted availability slot.
   */
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Delete an availability slot',
  })
  @Delete('availability/:id')
  deleteAvailability(
    @Request()
    req: Express.Request & {
      user: { userId: string };
    },
    @Param('id') id: string,
  ) {
    return this.interviewPlannerService.deleteAvailability(req.user.userId, id);
  }
  /**
   * Automatically schedules an interview
   * using the earliest available common
   * time slot between the employer and candidate.
   *
   * @param req Authenticated request
   * @param dto Application identifier
   * @returns Newly created interview
   */
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Automatically schedule an interview',
  })
  @Post('auto-schedule')
  autoScheduleInterview(
    @Request()
    req: Express.Request & {
      user: { userId: string };
    },
    @Body()
    dto: AutoScheduleInterviewDto,
  ) {
    return this.interviewPlannerService.autoScheduleInterview(req.user.userId, dto.applicationId);
  }
}
