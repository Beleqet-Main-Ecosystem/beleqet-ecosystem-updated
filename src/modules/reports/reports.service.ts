import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportStatus, ReportTarget } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const REPORT_REASONS = ['scam', 'asks_for_payment', 'misleading', 'offensive', 'spam', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * People flag a job or forum post; an admin dismisses the report or acts on it. Acting removes
 * the content (a job is archived, a forum post deleted) and closes every open report about it.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    reporterId: string,
    input: { targetType: ReportTarget; targetId: string; reason: ReportReason; details?: string },
  ) {
    if (input.reason === 'other' && !input.details?.trim()) {
      throw new BadRequestException('Say what is wrong when choosing "other"');
    }
    await this.assertTargetExists(input.targetType, input.targetId);
    try {
      await this.prisma.contentReport.create({
        data: {
          targetType: input.targetType,
          targetId: input.targetId,
          reporterId,
          reason: input.reason,
          details: input.details?.trim() || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You have already reported this');
      }
      throw error;
    }
    return { reported: true };
  }

  /** Reports with a given status, newest first, each with the title of what was reported. */
  async list(status: ReportStatus = 'OPEN') {
    const reports = await this.prisma.contentReport.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { reporter: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    const titles = await this.titles(reports);
    return reports.map((report) => ({
      ...report,
      targetTitle: titles.get(`${report.targetType}:${report.targetId}`) ?? null,
    }));
  }

  async resolve(reportId: string, adminId: string, input: { action: 'dismiss' | 'remove'; note?: string }) {
    const report = await this.prisma.contentReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'OPEN') throw new ConflictException('This report has already been handled');

    const resolved = { resolvedById: adminId, resolvedAt: new Date(), resolutionNote: input.note?.trim() || null };
    if (input.action === 'dismiss') {
      await this.prisma.contentReport.update({ where: { id: reportId }, data: { status: 'DISMISSED', ...resolved } });
      return { status: 'DISMISSED' as const };
    }

    await this.prisma.$transaction(async (tx) => {
      await this.removeTarget(tx, report.targetType, report.targetId);
      await tx.contentReport.updateMany({
        where: { targetType: report.targetType, targetId: report.targetId, status: 'OPEN' },
        data: { status: 'ACTIONED', ...resolved },
      });
    });
    return { status: 'ACTIONED' as const };
  }

  private async removeTarget(tx: Prisma.TransactionClient, type: ReportTarget, id: string) {
    if (type === 'JOB') {
      await tx.job.updateMany({ where: { id }, data: { status: 'ARCHIVED' } });
    } else if (type === 'FORUM_THREAD') {
      await tx.forumThread.deleteMany({ where: { id } });
    } else {
      const reply = await tx.forumReply.findUnique({ where: { id }, select: { threadId: true } });
      if (!reply) return;
      // Answers to this reply go with it, so count them before deleting.
      const removed = 1 + (await tx.forumReply.count({ where: { parentReplyId: id } }));
      await tx.forumReply.delete({ where: { id } });
      await tx.forumThread.update({ where: { id: reply.threadId }, data: { replyCount: { decrement: removed } } });
    }
  }

  private async assertTargetExists(type: ReportTarget, id: string) {
    const found =
      type === 'JOB'
        ? await this.prisma.job.findUnique({ where: { id }, select: { id: true } })
        : type === 'FORUM_THREAD'
          ? await this.prisma.forumThread.findUnique({ where: { id }, select: { id: true } })
          : await this.prisma.forumReply.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException('That item no longer exists');
  }

  private async titles(reports: Array<{ targetType: ReportTarget; targetId: string }>) {
    const ids = (type: ReportTarget) => reports.filter((r) => r.targetType === type).map((r) => r.targetId);
    const [jobs, threads, replies] = await Promise.all([
      this.prisma.job.findMany({ where: { id: { in: ids('JOB') } }, select: { id: true, title: true } }),
      this.prisma.forumThread.findMany({ where: { id: { in: ids('FORUM_THREAD') } }, select: { id: true, title: true } }),
      this.prisma.forumReply.findMany({ where: { id: { in: ids('FORUM_REPLY') } }, select: { id: true, content: true } }),
    ]);
    const entries: [string, string][] = [
      ...jobs.map((j): [string, string] => [`JOB:${j.id}`, j.title]),
      ...threads.map((t): [string, string] => [`FORUM_THREAD:${t.id}`, t.title]),
      ...replies.map((r): [string, string] => [`FORUM_REPLY:${r.id}`, r.content.slice(0, 120)]),
    ];
    return new Map(entries);
  }
}
