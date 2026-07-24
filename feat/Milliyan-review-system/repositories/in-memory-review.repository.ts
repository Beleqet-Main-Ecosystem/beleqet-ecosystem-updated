import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Review } from '../entities/review.entity';
import { IReviewRepository } from '../interfaces/review-repository.interface';

/**
 * Reference implementation of {@link IReviewRepository} backed by an
 * in-memory Map. Intended for local development and as the seam
 * demonstrated in unit tests. In staging/production this is replaced
 * by a TypeORM/Prisma-backed repository registered under the same
 * `REVIEW_REPOSITORY` DI token — the ReviewService requires no
 * changes when that swap happens.
 */
@Injectable()
export class InMemoryReviewRepository implements IReviewRepository {
  private readonly store = new Map<string, Review>();

  /** @inheritdoc */
  async create(review: Review): Promise<Review> {
    const now = new Date().toISOString();
    const entity: Review = {
      ...review,
      id: review.id || randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(entity.id, entity);
    return entity;
  }

  /** @inheritdoc */
  async findById(id: string): Promise<Review | null> {
    return this.store.get(id) ?? null;
  }

  /** @inheritdoc */
  async findByFreelancerId(freelancerId: string): Promise<Review[]> {
    return Array.from(this.store.values()).filter(
      (review) => review.freelancerId === freelancerId,
    );
  }

  /** @inheritdoc */
  async update(id: string, partial: Partial<Review>): Promise<Review> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`Review with id ${id} not found`);
    }
    const updated: Review = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.store.set(id, updated);
    return updated;
  }

  /** @inheritdoc */
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
