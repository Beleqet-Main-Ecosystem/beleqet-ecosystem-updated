import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReviewService } from './review.service';
import {
  IReviewRepository,
  REVIEW_REPOSITORY,
} from './interfaces/review-repository.interface';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review } from './entities/review.entity';

/**
 * Builds a fully-typed jest mock of {@link IReviewRepository}.
 * No `any` is used — every mock function is explicitly typed against
 * the interface it implements.
 */
function createMockRepository(): jest.Mocked<IReviewRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByFreelancerId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

describe('ReviewService', () => {
  let service: ReviewService;
  let repository: jest.Mocked<IReviewRepository>;

  const validDto: CreateReviewDto = {
    freelancerId: '11111111-1111-4111-8111-111111111111',
    customerId: '22222222-2222-4222-8222-222222222222',
    rating: 5,
    comment: 'Excellent work, delivered on time.',
    locale: 'en-US',
    transactionCurrency: 'USD',
    gdprConsentGiven: true,
  };

  beforeEach(async () => {
    repository = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: REVIEW_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    it('persists a valid review and returns it', async () => {
      const expected: Review = {
        id: 'generated-id',
        ...validDto,
        isAnonymized: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      repository.create.mockResolvedValue(expected);

      const result = await service.createReview(validDto);

      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expected);
    });

    it('rejects a review when GDPR consent was not given', async () => {
      const dto: CreateReviewDto = { ...validDto, gdprConsentGiven: false };

      await expect(service.createReview(dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a comment that exceeds the configured max length', async () => {
      const originalEnv = process.env.REVIEW_MAX_COMMENT_LENGTH;
      process.env.REVIEW_MAX_COMMENT_LENGTH = '10';

      // Re-instantiate so the service picks up the new env value.
      const shortLimitService = new ReviewService(repository);
      const dto: CreateReviewDto = {
        ...validDto,
        comment: 'This comment is definitely longer than ten characters.',
      };

      await expect(shortLimitService.createReview(dto)).rejects.toThrow(
        BadRequestException,
      );

      process.env.REVIEW_MAX_COMMENT_LENGTH = originalEnv;
    });
  });

  describe('getReviewById', () => {
    it('returns the review when found', async () => {
      const review: Review = {
        id: 'abc',
        ...validDto,
        isAnonymized: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      repository.findById.mockResolvedValue(review);

      const result = await service.getReviewById('abc');

      expect(result).toEqual(review);
    });

    it('throws NotFoundException when the review does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getReviewById('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('anonymizeReview', () => {
    it('scrubs personal fields while keeping the rating', async () => {
      const original: Review = {
        id: 'abc',
        ...validDto,
        isAnonymized: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const anonymized: Review = {
        ...original,
        customerId: 'REDACTED',
        comment: 'REDACTED',
        isAnonymized: true,
      };
      repository.findById.mockResolvedValue(original);
      repository.update.mockResolvedValue(anonymized);

      const result = await service.anonymizeReview('abc');

      expect(repository.update).toHaveBeenCalledWith(
        'abc',
        expect.objectContaining({ isAnonymized: true, comment: 'REDACTED' }),
      );
      expect(result.rating).toBe(original.rating); // rating preserved for aggregates
      expect(result.isAnonymized).toBe(true);
    });
  });

  describe('deleteReview', () => {
    it('deletes an existing review', async () => {
      const review: Review = {
        id: 'abc',
        ...validDto,
        isAnonymized: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      repository.findById.mockResolvedValue(review);

      await service.deleteReview('abc');

      expect(repository.delete).toHaveBeenCalledWith('abc');
    });

    it('throws NotFoundException when deleting a non-existent review', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.deleteReview('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
