import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ComparisonDocument } from '../types/plagiarism.types';
import { PlagiarismConfig } from '../utils/plagiarism.config';

/**
 * Loads text content from Beleqet platform tables for plagiarism comparison.
 * Compares against job descriptions, profiles, cover letters, and bids.
 */
@Injectable()
export class PlatformSourceService {
  private readonly logger = new Logger(PlatformSourceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: PlagiarismConfig,
  ) {}

  /**
   * Fetches platform documents that can be compared against submitted text.
   */
  async loadDocuments(excludeEntityId?: string): Promise<ComparisonDocument[]> {
    const limit = this.config.maxPlatformDocuments;

    const [jobs, freelanceJobs, applications, bids, users, companies] =
      await Promise.all([
        this.prisma.job.findMany({
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, title: true, description: true, requirements: true },
        }),
        this.prisma.freelanceJob.findMany({
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, title: true, description: true },
        }),
        this.prisma.application.findMany({
          take: limit,
          orderBy: { updatedAt: 'desc' },
          where: { coverLetter: { not: null } },
          select: { id: true, coverLetter: true, job: { select: { title: true } } },
        }),
        this.prisma.bid.findMany({
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            coverLetter: true,
            freelanceJob: { select: { title: true } },
          },
        }),
        this.prisma.user.findMany({
          take: limit,
          orderBy: { updatedAt: 'desc' },
          where: {
            OR: [{ bio: { not: null } }, { headline: { not: null } }],
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            bio: true,
            headline: true,
          },
        }),
        this.prisma.company.findMany({
          take: limit,
          orderBy: { updatedAt: 'desc' },
          where: { description: { not: null } },
          select: { id: true, name: true, description: true },
        }),
      ]);

    const documents: ComparisonDocument[] = [];

    for (const job of jobs) {
      if (job.id === excludeEntityId) continue;
      const content = [job.title, job.description, job.requirements]
        .filter(Boolean)
        .join('\n');
      if (content.trim().length > 0) {
        documents.push({
          id: job.id,
          entityType: 'Job',
          title: job.title,
          content,
          sourceType: 'platform',
        });
      }
    }

    for (const job of freelanceJobs) {
      if (job.id === excludeEntityId) continue;
      documents.push({
        id: job.id,
        entityType: 'FreelanceJob',
        title: job.title,
        content: `${job.title}\n${job.description}`,
        sourceType: 'platform',
      });
    }

    for (const application of applications) {
      if (application.id === excludeEntityId || !application.coverLetter) continue;
      documents.push({
        id: application.id,
        entityType: 'Application',
        title: application.job.title,
        content: application.coverLetter,
        sourceType: 'platform',
      });
    }

    for (const bid of bids) {
      if (bid.id === excludeEntityId) continue;
      documents.push({
        id: bid.id,
        entityType: 'Bid',
        title: bid.freelanceJob.title,
        content: bid.coverLetter,
        sourceType: 'platform',
      });
    }

    for (const user of users) {
      if (user.id === excludeEntityId) continue;
      const content = [user.headline, user.bio].filter(Boolean).join('\n');
      if (content.trim().length > 0) {
        documents.push({
          id: user.id,
          entityType: 'UserProfile',
          title: `${user.firstName} ${user.lastName}`,
          content,
          sourceType: 'platform',
        });
      }
    }

    for (const company of companies) {
      if (company.id === excludeEntityId || !company.description) continue;
      documents.push({
        id: company.id,
        entityType: 'Company',
        title: company.name,
        content: company.description,
        sourceType: 'platform',
      });
    }

    this.logger.debug(`Loaded ${documents.length} platform documents for comparison`);
    return documents;
  }
}
