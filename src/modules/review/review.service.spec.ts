import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review } from './entities/review.entity';
import { REVIEW_REPOSITORY } from './interfaces/review-repository.interface';
import { ReviewService } from './review.service';

const makeReview = (overrides: Partial<Review> = {}): Review => ({
  id: 'review-uuid-1',
  freelancerId: 'freelancer-uuid-1',
  customerId: 'customer-uuid-1',
  rating: 5,
  comment: 'Excellent work!',
  locale: 'en',
  transactionCurrency: 'USD',
  gdprConsentGiven: true,
  isAnonymized: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const mockRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByFreelancerId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

describe('ReviewService', () => {
  let service: ReviewService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: REVIEW_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── createReview ───────────────────────────────────────────────────────────

  describe('createReview', () => {
    const dto: CreateReviewDto = {
      freelancerId: 'freelancer-uuid-1',
      customerId: 'customer-uuid-1',
      rating: 5,
      comment: 'Great job!',
      locale: 'en',
      transactionCurrency: 'USD',
      gdprConsentGiven: true,
    };

    it('creates and returns a review when GDPR consent is given', async () => {
      const stored = makeReview();
      mockRepository.create.mockResolvedValue(stored);

      const result = await service.createReview(dto);

      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      expect(result.freelancerId).toBe(dto.freelancerId);
      expect(result.rating).toBe(dto.rating);
    });

    it('throws BadRequestException when gdprConsentGiven is false', async () => {
      await expect(
        service.createReview({ ...dto, gdprConsentGiven: false }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when comment exceeds max length', async () => {
      const longComment = 'x'.repeat(1001);
      await expect(
        service.createReview({ ...dto, comment: longComment }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a comment exactly at the max length boundary', async () => {
      const boundaryComment = 'x'.repeat(1000);
      const stored = makeReview({ comment: boundaryComment });
      mockRepository.create.mockResolvedValue(stored);

      await expect(
        service.createReview({ ...dto, comment: boundaryComment }),
      ).resolves.not.toThrow();
    });

    it('assigns a new UUID id to each review', async () => {
      const stored = makeReview();
      mockRepository.create.mockResolvedValue(stored);

      await service.createReview(dto);

      const created: Review = mockRepository.create.mock.calls[0][0];
      expect(typeof created.id).toBe('string');
      expect(created.id.length).toBeGreaterThan(0);
    });
  });

  // ─── getReviewsForFreelancer ─────────────────────────────────────────────────

  describe('getReviewsForFreelancer', () => {
    it('returns all reviews for a given freelancer', async () => {
      const reviews = [makeReview(), makeReview({ id: 'review-uuid-2', rating: 4 })];
      mockRepository.findByFreelancerId.mockResolvedValue(reviews);

      const result = await service.getReviewsForFreelancer('freelancer-uuid-1');

      expect(mockRepository.findByFreelancerId).toHaveBeenCalledWith('freelancer-uuid-1');
      expect(result).toHaveLength(2);
    });

    it('returns an empty array when the freelancer has no reviews', async () => {
      mockRepository.findByFreelancerId.mockResolvedValue([]);

      const result = await service.getReviewsForFreelancer('freelancer-no-reviews');

      expect(result).toEqual([]);
    });
  });

  // ─── getReviewById ───────────────────────────────────────────────────────────

  describe('getReviewById', () => {
    it('returns the review when it exists', async () => {
      const review = makeReview();
      mockRepository.findById.mockResolvedValue(review);

      const result = await service.getReviewById('review-uuid-1');

      expect(result.id).toBe('review-uuid-1');
    });

    it('throws NotFoundException when review does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.getReviewById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateReview ────────────────────────────────────────────────────────────

  describe('updateReview', () => {
    it('updates and returns the review', async () => {
      const existing = makeReview();
      const updated = makeReview({ rating: 3, comment: 'Changed my mind' });
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(updated);

      const dto: UpdateReviewDto = { rating: 3, comment: 'Changed my mind' };
      const result = await service.updateReview('review-uuid-1', dto);

      expect(mockRepository.update).toHaveBeenCalledWith('review-uuid-1', dto);
      expect(result.rating).toBe(3);
    });

    it('throws NotFoundException when review to update does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateReview('non-existent', { rating: 4 }),
      ).rejects.toThrow(NotFoundException);

      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  // ─── anonymizeReview ─────────────────────────────────────────────────────────

  describe('anonymizeReview', () => {
    it('sets customerId to REDACTED, comment to REDACTED, and isAnonymized to true', async () => {
      const existing = makeReview();
      const anonymized = makeReview({
        customerId: 'REDACTED',
        comment: 'REDACTED',
        isAnonymized: true,
      });
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(anonymized);

      const result = await service.anonymizeReview('review-uuid-1');

      expect(mockRepository.update).toHaveBeenCalledWith('review-uuid-1', {
        customerId: 'REDACTED',
        comment: 'REDACTED',
        isAnonymized: true,
      });
      expect(result.isAnonymized).toBe(true);
      expect(result.comment).toBe('REDACTED');
    });

    it('throws NotFoundException when review to anonymize does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.anonymizeReview('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deleteReview ────────────────────────────────────────────────────────────

  describe('deleteReview', () => {
    it('calls repository delete for an existing review', async () => {
      mockRepository.findById.mockResolvedValue(makeReview());
      mockRepository.delete.mockResolvedValue(undefined);

      await expect(service.deleteReview('review-uuid-1')).resolves.toBeUndefined();

      expect(mockRepository.delete).toHaveBeenCalledWith('review-uuid-1');
    });

    it('throws NotFoundException when review to delete does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.deleteReview('non-existent')).rejects.toThrow(NotFoundException);

      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });
});
