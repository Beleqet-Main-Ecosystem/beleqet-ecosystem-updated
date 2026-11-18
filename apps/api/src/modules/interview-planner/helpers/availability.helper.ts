import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { Prisma } from '@prisma/client';
import { AvailabilityOverlap } from '../types/availability.types';
import { InterviewStatus } from '@prisma/client';
/**
 * Helper responsible for validating user availability,
 * detecting interview scheduling conflicts, and selecting
 * the earliest available interview slot.
 */
@Injectable()
export class AvailabilityHelper {
  constructor(
    private readonly i18n: I18nService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Validates that both the employer and candidate are
   * available for the requested interview time.
   *
   * Throws a ConflictException if either participant does
   * not have an availability slot that fully covers the
   * requested time range.
   *
   * @param client Prisma client or transaction client
   * @param employerId Employer user identifier
   * @param candidateId Candidate user identifier
   * @param startTime Interview start time
   * @param endTime Interview end time
   * @returns Promise that resolves when both users are available
   */
  async validateAvailability(
    client: PrismaService | Prisma.TransactionClient,
    employerId: string,
    candidateId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    const [employerAvailability, candidateAvailability] = await Promise.all([
      client.userAvailability.findFirst({
        where: {
          userId: employerId,
          startTime: { lte: startTime },
          endTime: { gte: endTime },
        },
      }),
      client.userAvailability.findFirst({
        where: {
          userId: candidateId,
          startTime: { lte: startTime },
          endTime: { gte: endTime },
        },
      }),
    ]);

    if (!employerAvailability) {
      throw new ConflictException(
        await this.i18n.translate('interview.availability.employerUnavailable'),
      );
    }

    if (!candidateAvailability) {
      throw new ConflictException(
        await this.i18n.translate('interview.availability.candidateUnavailable'),
      );
    }
  }

  /**
   * Validates that neither the employer nor the candidate
   * already has another scheduled interview during the
   * requested time range.
   *
   * Throws a ConflictException if an overlapping interview
   * already exists.
   *
   * @param client Prisma client or transaction client
   * @param employerId Employer user identifier
   * @param candidateId Candidate user identifier
   * @param startTime Interview start time
   * @param endTime Interview end time
   * @returns Promise that resolves when no interview conflicts exist
   */
  async validateInterviewConflicts(
    client: PrismaService | Prisma.TransactionClient,
    employerId: string,
    candidateId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    const [candidateConflict, employerConflict] = await Promise.all([
      client.interview.findFirst({
        where: {
          candidateId,
          status: InterviewStatus.SCHEDULED,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      }),
      client.interview.findFirst({
        where: {
          employerId,
          status: InterviewStatus.SCHEDULED,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      }),
    ]);
    if (candidateConflict) {
      throw new ConflictException(await this.i18n.translate('interview.interview.candidateBusy'));
    }

    if (employerConflict) {
      throw new ConflictException(await this.i18n.translate('interview.interview.employerBusy'));
    }
  }
  /**
   * Finds the earliest interview slot that can accommodate
   * the required interview duration without conflicting
   * with existing scheduled interviews.
   *
   * The method iterates through each common availability
   * window and checks candidate interview times until a
   * conflict-free slot is found.
   *
   * @param commonSlots Common availability windows shared by both users
   * @param employerId Employer user identifier
   * @param candidateId Candidate user identifier
   * @param durationMinutes Required interview duration in minutes
   * @returns The earliest available interview slot, or null if none exists
   */
  async findEarliestAvailableSlot(
    commonSlots: AvailabilityOverlap[],
    employerId: string,
    candidateId: string,
    durationMinutes: number,
  ) {
    for (const slot of commonSlots) {
      let currentStart = new Date(slot.startTime);

      while (currentStart.getTime() + durationMinutes * 60 * 1000 <= slot.endTime.getTime()) {
        const possibleEnd = new Date(currentStart.getTime() + durationMinutes * 60 * 1000);

        const conflict = await this.prisma.interview.findFirst({
          where: {
            status: InterviewStatus.SCHEDULED,
            OR: [{ employerId }, { candidateId }],
            startTime: {
              lt: possibleEnd,
            },
            endTime: {
              gt: currentStart,
            },
          },
        });

        if (!conflict) {
          return {
            startTime: currentStart,
            endTime: possibleEnd,
            timezone: slot.timezone,
          };
        }

        currentStart = new Date(currentStart.getTime() + durationMinutes * 60 * 1000);
      }
    }

    return null;
  }
}
