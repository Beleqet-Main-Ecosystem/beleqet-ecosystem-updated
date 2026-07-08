import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { I18nService } from 'nestjs-i18n';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { AvailabilityHelper } from './helpers/availability.helper';
import { CommonAvailabilityHelper } from './helpers/common-availability.helper';
import { ApplicationHelper } from './helpers/application.helper';
import { DateHelper } from './helpers/date.helper';
import { ApplicationStatus, Prisma } from '@prisma/client';

@Injectable()
export class InterviewPlannerService {
  private readonly logger = new Logger(InterviewPlannerService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly notificationsService: NotificationsService,
    private readonly availabilityHelper: AvailabilityHelper,
    private readonly commonAvailabilityHelper: CommonAvailabilityHelper,
    private readonly applicationHelper: ApplicationHelper,
    private readonly dateHelper: DateHelper,
  ) {}

  /**
   * Creates an availability slot for a user.
   *
   * Prevents invalid time ranges and overlapping
   * availability slots for the same user.
   *
   * @param userId User identifier
   * @param dto Availability details
   * @returns Newly created availability slot
   * @throws BadRequestException If the time range is invalid
   * @throws ConflictException If the availability overlaps an existing slot
   */

  async createAvailability(userId: string, dto: CreateAvailabilityDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    await this.dateHelper.validateRange(startTime, endTime);
    const overlappingSlot = await this.prisma.userAvailability.findFirst({
      where: {
        userId,
        startTime: {
          lt: endTime,
        },
        endTime: {
          gt: startTime,
        },
      },
    });

    if (overlappingSlot) {
      throw new ConflictException(await this.i18n.translate('interview.availability.overlap'));
    }
    return this.prisma.userAvailability.create({
      data: {
        userId,
        startTime,
        endTime,
        timezone: dto.timezone ?? 'UTC',
      },
    });
  }
  /**
   * Retrieves all availability slots for a user.
   *
   * Slots are returned in chronological order.
   *
   * @param userId User identifier
   * @returns User availability slots
   */
  async getUserAvailabilities(userId: string) {
    return this.prisma.userAvailability.findMany({
      where: {
        userId,
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  /**
   * Creates an interview for an application.
   *
   * Validates:
   * - Interview duration
   * - Employer ownership
   * - Candidate availability
   * - Employer availability
   * - Existing interview conflicts
   *
   * Updates the application status and sends
   * interview notifications after a successful transaction.
   *
   * @param employerId Employer user identifier
   * @param dto Interview scheduling details
   * @returns Newly created interview
   * @throws BadRequestException If the interview duration is invalid
   * @throws ConflictException If scheduling rules are violated
   */
  async createInterview(employerId: string, dto: CreateInterviewDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const requestedDurationMinutes = Math.ceil((endTime.getTime() - startTime.getTime()) / 60000);
    await this.dateHelper.validateRange(startTime, endTime);

    const application = await this.applicationHelper.validateInterviewApplication(
      employerId,
      dto.applicationId,
    );

    const candidateId = application.userId;
    const interviewDurationMinutes = application.job.interviewDurationMinutes ?? 60;
    if (requestedDurationMinutes !== interviewDurationMinutes) {
      throw new BadRequestException(
        await this.i18n.translate('interview.interview.invalidDuration'),
      );
    }
    const interview = await this.prisma.$transaction(
      async (tx) => {
        await this.availabilityHelper.validateAvailability(
          tx,
          employerId,
          candidateId,
          startTime,
          endTime,
        );

        await this.availabilityHelper.validateInterviewConflicts(
          tx,
          employerId,
          candidateId,
          startTime,
          endTime,
        );
        const createdInterview = await tx.interview.create({
          data: {
            applicationId: application.id,
            employerId,
            candidateId,
            startTime,
            endTime,
            timezone: dto.timezone ?? 'UTC',
            notes: dto.notes,
            durationMinutes: interviewDurationMinutes,
          },
        });

        await tx.application.update({
          where: {
            id: application.id,
          },
          data: {
            status: ApplicationStatus.INTERVIEW_SCHEDULED,
            interviewSlot: startTime,
          },
        });

        return createdInterview;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
    await this.notificationsService.sendInterviewScheduled(
      interview.id,
      employerId,
      candidateId,
      application.job.title,
      interview.startTime,
      interview.endTime,
      interview.timezone,
    );
    this.logger.log(`Interview ${interview.id} scheduled by employer ${employerId}`);
    return interview;
  }
  /**
   * Finds overlapping availability slots shared
   * by both the employer and candidate.
   *
   * @param employerId Employer user identifier
   * @param candidateId Candidate user identifier
   * @returns List of common availability slots
   */
  async findCommonAvailability(employerId: string, candidateId: string) {
    return this.commonAvailabilityHelper.findCommonAvailability(employerId, candidateId);
  }
  /**
   * Automatically schedules an interview using
   * the earliest available common time slot.
   *
   * Workflow:
   * - Validates the application
   * - Finds common availability
   * - Selects the earliest conflict-free slot
   * - Creates the interview
   * - Sends notifications
   *
   * @param employerId Employer user identifier
   * @param applicationId Application identifier
   * @returns Newly created interview
   * @throws ConflictException If no suitable interview slot exists
   */
  async autoScheduleInterview(employerId: string, applicationId: string) {
    // validate the interview application and get the candidate id
    const application = await this.applicationHelper.validateInterviewApplication(
      employerId,
      applicationId,
    );

    const candidateId = application.userId;
    const interviewDurationMinutes = application.job.interviewDurationMinutes ?? 60;

    const commonSlots = await this.findCommonAvailability(employerId, candidateId);

    if (!commonSlots.length) {
      throw new ConflictException(
        await this.i18n.translate('interview.interview.noCommonAvailability'),
      );
    }

    // Find the earliest conflict-free common availability.
    const selectedSlot = await this.availabilityHelper.findEarliestAvailableSlot(
      commonSlots,
      employerId,
      candidateId,
      interviewDurationMinutes,
    );

    if (!selectedSlot) {
      throw new ConflictException(await this.i18n.translate('interview.interview.noAvailableSlot'));
    }

    return this.createInterview(employerId, {
      applicationId,

      startTime: selectedSlot.startTime.toISOString(),

      endTime: selectedSlot.endTime.toISOString(),

      timezone: selectedSlot.timezone,
    });
  }
}
