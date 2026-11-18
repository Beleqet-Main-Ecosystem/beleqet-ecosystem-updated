import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

import { AvailabilityOverlap } from '../types/availability.types';
/**
 * Helper responsible for calculating shared availability
 * between two users.
 *
 * Uses a two-pointer algorithm to efficiently find all
 * overlapping availability windows between an employer
 * and a candidate in chronological order.
 */
@Injectable()
export class CommonAvailabilityHelper {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds all common availability windows between an employer
   * and a candidate.
   *
   * Both users' availability slots are sorted by start time and
   * compared using a two-pointer intersection algorithm to avoid
   * the O(n²) complexity of nested loops.
   *
   * Each returned overlap represents a time window during which
   * both users are simultaneously available.
   *
   * @param employerId Employer user identifier
   * @param candidateId Candidate user identifier
   * @returns List of overlapping availability windows ordered by start time
   */
  async findCommonAvailability(
    employerId: string,
    candidateId: string,
  ): Promise<AvailabilityOverlap[]> {
    const [employerSlots, candidateSlots] = await Promise.all([
      this.prisma.userAvailability.findMany({
        where: {
          userId: employerId,
        },
        orderBy: {
          startTime: 'asc',
        },
      }),

      this.prisma.userAvailability.findMany({
        where: {
          userId: candidateId,
        },
        orderBy: {
          startTime: 'asc',
        },
      }),
    ]);
    // Uses a two-pointer intersection algorithm to efficiently
    // find overlapping availability windows in O(n + m) time.
    let employerIndex = 0;
    let candidateIndex = 0;

    const overlaps: AvailabilityOverlap[] = [];

    while (employerIndex < employerSlots.length && candidateIndex < candidateSlots.length) {
      const employerSlot = employerSlots[employerIndex];
      const candidateSlot = candidateSlots[candidateIndex];

      const overlapStart =
        employerSlot.startTime > candidateSlot.startTime
          ? employerSlot.startTime
          : candidateSlot.startTime;

      const overlapEnd =
        employerSlot.endTime < candidateSlot.endTime ? employerSlot.endTime : candidateSlot.endTime;

      if (overlapStart < overlapEnd) {
        overlaps.push({
          startTime: overlapStart,
          endTime: overlapEnd,
          timezone: employerSlot.timezone,
        });
      }

      if (employerSlot.endTime < candidateSlot.endTime) {
        employerIndex++;
      } else {
        candidateIndex++;
      }
    }

    return overlaps;
  }
}
