import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PlagiarismCheckResult } from '../types/plagiarism.types';

/** Event type stored in the shared events_log table. */
const PLAGIARISM_EVENT_TYPE = 'PLAGIARISM_CHECK';

/**
 * Persists plagiarism check results using the platform EventLog table.
 */
@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Saves a check result for later review and auditing.
   */
  async save(result: PlagiarismCheckResult): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        eventType: PLAGIARISM_EVENT_TYPE,
        entityId: result.checkId,
        entityType: 'PlagiarismCheck',
        payload: result as unknown as any,
      },
    });
  }

  /**
   * Returns recent plagiarism checks, newest first.
   */
  async findRecent(limit = 20): Promise<PlagiarismCheckResult[]> {
    const records = await this.prisma.eventLog.findMany({
      where: { eventType: PLAGIARISM_EVENT_TYPE },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((record: { payload: unknown }) =>
      record.payload as unknown as PlagiarismCheckResult,
    );
  }

  /**
   * Returns a single check by its ID.
   */
  async findById(checkId: string): Promise<PlagiarismCheckResult> {
    const record = await this.prisma.eventLog.findFirst({
      where: {
        eventType: PLAGIARISM_EVENT_TYPE,
        entityId: checkId,
      },
    });

    if (!record) {
      throw new NotFoundException(`Plagiarism check ${checkId} not found`);
    }

    return record.payload as unknown as PlagiarismCheckResult;
  }
}
