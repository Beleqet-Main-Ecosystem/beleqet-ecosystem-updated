import { Body, Controller, Post, UseGuards, Request, Get } from '@nestjs/common';
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
