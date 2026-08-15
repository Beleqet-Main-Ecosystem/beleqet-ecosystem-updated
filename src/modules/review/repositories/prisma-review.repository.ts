import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Review } from '../entities/review.entity';
import { IReviewRepository } from '../interfaces/review-repository.interface';

@Injectable()
export class PrismaReviewRepository implements IReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(review: Review): Promise<Review> {
    const record = await this.prisma.review.create({
      data: {
        id: review.id,
        freelancerId: review.freelancerId,
        customerId: review.customerId,
        rating: review.rating,
        comment: review.comment,
        locale: review.locale,
        transactionCurrency: review.transactionCurrency,
        gdprConsentGiven: review.gdprConsentGiven,
        isAnonymized: false,
      },
    });
    return this.toEntity(record);
  }

  async findById(id: string): Promise<Review | null> {
    const record = await this.prisma.review.findUnique({ where: { id } });
    return record ? this.toEntity(record) : null;
  }

  async findByFreelancerId(freelancerId: string): Promise<Review[]> {
    const records = await this.prisma.review.findMany({
      where: { freelancerId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(this.toEntity);
  }

  async update(id: string, partial: Partial<Review>): Promise<Review> {
    const record = await this.prisma.review.update({
      where: { id },
      data: {
        ...(partial.rating !== undefined && { rating: partial.rating }),
        ...(partial.comment !== undefined && { comment: partial.comment }),
        ...(partial.locale !== undefined && { locale: partial.locale }),
        ...(partial.transactionCurrency !== undefined && {
          transactionCurrency: partial.transactionCurrency,
        }),
        ...(partial.customerId !== undefined && { customerId: partial.customerId }),
        ...(partial.isAnonymized !== undefined && { isAnonymized: partial.isAnonymized }),
      },
    });
    return this.toEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.review.delete({ where: { id } });
  }

  private toEntity(record: {
    id: string;
    freelancerId: string;
    customerId: string;
    rating: number;
    comment: string;
    locale: string;
    transactionCurrency: string;
    gdprConsentGiven: boolean;
    isAnonymized: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Review {
    return {
      id: record.id,
      freelancerId: record.freelancerId,
      customerId: record.customerId,
      rating: record.rating,
      comment: record.comment,
      locale: record.locale,
      transactionCurrency: record.transactionCurrency,
      gdprConsentGiven: record.gdprConsentGiven,
      isAnonymized: record.isAnonymized,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
