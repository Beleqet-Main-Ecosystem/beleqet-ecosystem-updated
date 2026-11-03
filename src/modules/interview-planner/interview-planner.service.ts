import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
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
    const availability = await this.prisma.userAvailability.create({
      data: {
        userId,
        startTime,
        endTime,
        timezone: dto.timezone ?? 'UTC',
      },
    });

    return {
      message: await this.i18n.translate('interview.availability.created'),
      data: availability,
    };
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
   * Updates an existing availability slot.
   *
   * Validates:
   * - Slot ownership
   * - Valid time range
   * - No overlap with other availability slots
   *
   * @param userId User identifier
   * @param id Availability slot identifier
   * @param dto Updated availability details
   * @returns Updated availability slot
   * @throws BadRequestException If the slot does not exist
   * @throws ConflictException If the updated slot overlaps another slot
   */
  async updateAvailability(userId: string, id: string, dto: CreateAvailabilityDto) {
    const availability = await this.prisma.userAvailability.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!availability) {
      throw new NotFoundException(await this.i18n.translate('interview.availability.notFound'));
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    await this.dateHelper.validateRange(startTime, endTime);

    const overlapping = await this.prisma.userAvailability.findFirst({
      where: {
        userId,
        id: {
          not: id,
        },
        startTime: {
          lt: endTime,
        },
        endTime: {
          gt: startTime,
        },
      },
    });

    if (overlapping) {
      throw new ConflictException(await this.i18n.translate('interview.availability.overlap'));
    }

    const updatedAvailability = await this.prisma.userAvailability.update({
      where: { id },
      data: {
        startTime,
        endTime,
        timezone: dto.timezone ?? 'UTC',
      },
    });

    return {
      message: await this.i18n.translate('interview.availability.updated'),
      data: updatedAvailability,
    };
  }
  /**
   * Deletes an availability slot belonging
   * to the authenticated user.
   *
   * @param userId User identifier
   * @param id Availability slot identifier
   * @returns Deleted availability slot
   * @throws BadRequestException If the slot does not exist
   */
  async deleteAvailability(userId: string, id: string) {
    const availability = await this.prisma.userAvailability.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!availability) {
      throw new NotFoundException(await this.i18n.translate('interview.availability.notFound'));
    }

    await this.prisma.userAvailability.delete({
      where: { id },
    });

    return {
      message: await this.i18n.translate('interview.availability.deleted'),
    };
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

  async myInterviews(userId: string) {
    return this.prisma.interview.findMany({
      where: { OR: [{ candidateId: userId }, { employerId: userId }] },
      orderBy: { startTime: 'asc' },
      include: {
        application: {
          select: {
            id: true,
            job: { select: { id: true, title: true, location: true, company: { select: { name: true, userId: true } } } },
          },
        },
        candidate: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async respond(candidateId: string, interviewId: string, dto: { response: 'CONFIRMED' | 'DECLINED'; note?: string }) {
    const interview = await this.prisma.interview.findFirst({ where: { id: interviewId, candidateId } });
    if (!interview) throw new NotFoundException('Interview not found');
    if (!['SCHEDULED', 'RESCHEDULED', 'CONFIRMED'].includes(interview.status)) {
      throw new BadRequestException('This interview can no longer be answered');
    }
    if (interview.startTime < new Date()) throw new BadRequestException('This interview has already started');
    const updated = await this.prisma.interview.update({
      where: { id: interviewId },
      data: { status: dto.response, candidateNote: dto.note?.trim() || null },
    });
    // Let the employer know; a failed notification must not undo the answer.
    this.prisma.notification
      .create({
        data: {
          userId: interview.employerId,
          type: 'INTERVIEW',
          title: dto.response === 'CONFIRMED' ? 'Interview confirmed' : 'Interview declined',
          body: dto.note?.trim() || (dto.response === 'CONFIRMED' ? 'The candidate will attend.' : 'The candidate cannot attend.'),
          channel: 'IN_APP',
          metadata: { interviewId },
        },
      })
      .catch(() => undefined);
    return updated;
  }

  async updateDetails(
    employerId: string,
    interviewId: string,
    dto: { location?: string | null; meetingLink?: string | null; notes?: string | null },
  ) {
    const { count } = await this.prisma.interview.updateMany({
      where: { id: interviewId, employerId },
      data: {
        location: dto.location === undefined ? undefined : dto.location?.trim() || null,
        meetingLink: dto.meetingLink,
        notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
      },
    });
    if (count === 0) throw new NotFoundException('Interview not found');
    return this.prisma.interview.findUnique({ where: { id: interviewId } });
  }
}
