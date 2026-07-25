import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { VECTOR_PROVIDER } from './vector-provider.token';
import type { VectorProvider } from '../interfaces/vector-provider.interface';
import type { Embedding } from '../interfaces/embedding.interface';

export interface GenerateEmbeddingsPayload {
  readonly entityType: 'user' | 'freelanceJob' | 'job';
  readonly entityId?: string;
}

export interface EmbeddingResultReport {
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

@Injectable()
export class EmbeddingWorkerService {
  private readonly logger = new Logger(EmbeddingWorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    @Inject(VECTOR_PROVIDER) private readonly vectorProvider: VectorProvider,
  ) {}

  async generateEmbeddings(payload: GenerateEmbeddingsPayload): Promise<EmbeddingResultReport> {
    const { entityType, entityId } = payload;

    const report: EmbeddingResultReport = { processed: 0, succeeded: 0, failed: 0, errors: [] };

    if (entityType === 'user') {
      await this.processUsers(entityId, report);
    } else if (entityType === 'freelanceJob') {
      await this.processFreelanceJobs(entityId, report);
    } else if (entityType === 'job') {
      await this.processJobs(entityId, report);
    }

    this.logger.log(
      `Embedding generation complete: ${report.succeeded}/${report.processed} succeeded, ${report.failed} failed`,
    );
    return report;
  }

  private async processUsers(
    entityId: string | undefined,
    report: EmbeddingResultReport,
  ): Promise<void> {
    const users = entityId
      ? await this.prisma.user.findMany({ where: { id: entityId } })
      : await this.prisma.user.findMany({
          where: { role: 'FREELANCER', isActive: true },
        });

    report.processed = users.length;

    for (const user of users) {
      try {
        const text = [user.headline, user.bio, ...(user.skills ?? [])].filter(Boolean).join('\n\n');

        if (!text.trim()) {
          report.failed++;
          report.errors = [...report.errors, `User ${user.id}: empty profile text`];
          continue;
        }

        const result = await this.embeddingService.embedText(text);

        const embedding: Embedding = {
          vector: result.embedding.vector,
          model: result.embedding.model,
          dimensions: result.embedding.dimensions,
          freelancerId: user.id,
          entityType: 'freelancer',
        };

        await this.vectorProvider.upsert([embedding]);
        report.succeeded++;
      } catch (error) {
        report.failed++;
        const msg = error instanceof Error ? error.message : String(error);
        report.errors = [...report.errors, `User ${user.id}: ${msg}`];
        this.logger.error(`Failed to embed user ${user.id}: ${msg}`);
      }
    }
  }

  private async processFreelanceJobs(
    entityId: string | undefined,
    report: EmbeddingResultReport,
  ): Promise<void> {
    const jobs = entityId
      ? await this.prisma.freelanceJob.findMany({ where: { id: entityId } })
      : await this.prisma.freelanceJob.findMany();

    report.processed = jobs.length;

    for (const job of jobs) {
      try {
        const text = [job.title, job.description, ...(job.skills ?? [])]
          .filter(Boolean)
          .join('\n\n');

        if (!text.trim()) {
          report.failed++;
          report.errors = [...report.errors, `FreelanceJob ${job.id}: empty text`];
          continue;
        }

        const result = await this.embeddingService.embedText(text);

        const embedding: Embedding = {
          vector: result.embedding.vector,
          model: result.embedding.model,
          dimensions: result.embedding.dimensions,
          freelancerId: job.id,
          entityType: 'freelanceJob',
        };

        await this.vectorProvider.upsert([embedding]);
        report.succeeded++;
      } catch (error) {
        report.failed++;
        const msg = error instanceof Error ? error.message : String(error);
        report.errors = [...report.errors, `FreelanceJob ${job.id}: ${msg}`];
        this.logger.error(`Failed to embed freelance job ${job.id}: ${msg}`);
      }
    }
  }

  private async processJobs(
    entityId: string | undefined,
    report: EmbeddingResultReport,
  ): Promise<void> {
    const jobs = entityId
      ? await this.prisma.job.findMany({ where: { id: entityId } })
      : await this.prisma.job.findMany();

    report.processed = jobs.length;

    for (const job of jobs) {
      try {
        const text = [job.title, job.description, ...(job.tags ?? [])].filter(Boolean).join('\n\n');

        if (!text.trim()) {
          report.failed++;
          report.errors = [...report.errors, `Job ${job.id}: empty text`];
          continue;
        }

        const result = await this.embeddingService.embedText(text);

        const embedding: Embedding = {
          vector: result.embedding.vector,
          model: result.embedding.model,
          dimensions: result.embedding.dimensions,
          freelancerId: job.id,
          entityType: 'job',
        };

        await this.vectorProvider.upsert([embedding]);
        report.succeeded++;
      } catch (error) {
        report.failed++;
        const msg = error instanceof Error ? error.message : String(error);
        report.errors = [...report.errors, `Job ${job.id}: ${msg}`];
        this.logger.error(`Failed to embed job ${job.id}: ${msg}`);
      }
    }
  }
}
