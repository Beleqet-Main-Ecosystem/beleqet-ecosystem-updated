import { Injectable, Logger } from '@nestjs/common';
import type { VectorProvider } from '../interfaces/vector-provider.interface';
import type {
  VectorSearchQuery,
  VectorSearchHit,
  VectorSearchResult,
} from '../interfaces/vector-search.interface';
import type { Embedding } from '../interfaces/embedding.interface';
import { PrismaService } from '../../../prisma/prisma.service';

/** Shape of a raw row returned by the pgvector query against the users table. */
interface PgVectorUserRow {
  id: string;
  headline: string | null;
  bio: string | null;
  skills: string[];
  embedding: string;
  similarity: number;
}

/**
 * Concrete VectorProvider that executes cosine similarity search against
 * the `users` table's inline `embedding` column (vector(1536)) using
 * the `<=>` operator.
 *
 * Uses PrismaService (via Prisma's $queryRawUnsafe) for parameterised queries.
 * The HNSW index idx_users_embedding accelerates the ORDER BY distance clause.
 */
@Injectable()
export class PgVectorSearchProvider implements VectorProvider {
  private readonly logger = new Logger(PgVectorSearchProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(query: VectorSearchQuery): Promise<VectorSearchResult> {
    const start = Date.now();
    const { embedding, topK, minScore, filters } = query;

    const conditions: string[] = ['"embedding" IS NOT NULL'];
    const params: unknown[] = [];
    let paramIndex = 1;

    conditions.push(`1 - ("embedding" <=> $${paramIndex}::vector) >= $${paramIndex + 1}`);
    params.push(`[${embedding.join(',')}]`, minScore);
    paramIndex += 2;

    if (filters) {
      if (filters.requiredSkills && filters.requiredSkills.length > 0) {
        conditions.push(`"skills" @> $${paramIndex}::text[]`);
        params.push(filters.requiredSkills);
        paramIndex++;
      }
      if (filters.excludedFreelancerIds && filters.excludedFreelancerIds.length > 0) {
        const placeholders = filters.excludedFreelancerIds.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`"id" NOT IN (${placeholders})`);
        params.push(...filters.excludedFreelancerIds);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        "id",
        "headline",
        "bio",
        "skills",
        "embedding"::text AS "embedding",
        1 - ("embedding" <=> $1::vector) AS similarity
      FROM "users"
      ${whereClause}
      ORDER BY "embedding" <=> $1::vector ASC
      LIMIT ${topK}
    `;

    let rows: PgVectorUserRow[];
    try {
      rows = await this.prisma.$queryRawUnsafe<PgVectorUserRow[]>(sql, ...params);
    } catch (error) {
      this.logger.error(
        'pgvector search query failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    const hits: readonly VectorSearchHit[] = rows.map((row) => ({
      freelancerId: row.id,
      score: row.similarity,
      embedding: this.extractVector(row.embedding),
      metadata: {
        title: row.headline ?? '',
        bio: row.bio ?? '',
        skills: row.skills ?? [],
      },
    }));

    const latencyMs = Date.now() - start;

    return {
      hits,
      query,
      totalCandidates: hits.length,
      latencyMs,
    };
  }

  async upsert(embeddings: readonly Embedding[]): Promise<void> {
    for (const emb of embeddings) {
      if (!emb.freelancerId || !emb.entityType) {
        this.logger.warn('Skipping upsert — missing freelancerId or entityType on embedding');
        continue;
      }

      const table = this.tableForEntity(emb.entityType);
      const vectorLit = `[${emb.vector.join(',')}]`;
      try {
        await this.prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "embedding" = $1::vector WHERE "id" = $2`,
          vectorLit,
          emb.freelancerId,
        );
      } catch (error) {
        this.logger.error(
          'pgvector upsert failed',
          error instanceof Error ? error.stack : undefined,
        );
        throw error;
      }
    }
  }

  async delete(freelancerIds: readonly string[]): Promise<void> {
    if (freelancerIds.length === 0) return;
    const placeholders = freelancerIds.map((_, i) => `$${i + 1}`).join(', ');
    const ids = [...freelancerIds];
    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "users" SET "embedding" = NULL WHERE "id" IN (${placeholders})`,
        ...ids,
      );
    } catch (error) {
      this.logger.error('pgvector delete failed', error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  /** Map an entity type to its database table name. */
  private tableForEntity(entityType: NonNullable<Embedding['entityType']>): string {
    switch (entityType) {
      case 'freelancer':
        return 'users';
      case 'freelanceJob':
        return 'freelance_jobs';
      case 'job':
        return 'jobs';
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  /**
   * Extract a number[] from the raw vector value returned by pgvector.
   * pgvector returns vectors as an unknown buffer format; we coerce via JSON.
   */
  private extractVector(raw: unknown): readonly number[] {
    if (Array.isArray(raw)) return raw.map(Number);
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as number[];
      } catch {
        /* fall through */
      }
    }
    return [];
  }
}
