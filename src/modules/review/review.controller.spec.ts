import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review } from './entities/review.entity';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

const makeReview = (overrides: Partial<Review> = {}): Review => ({
  id: 'review-uuid-1',
  freelancerId: 'freelancer-uuid-1',
  customerId: 'customer-uuid-1',
  rating: 5,
  comment: 'Great work!',
  locale: 'en',
  transactionCurrency: 'USD',
  gdprConsentGiven: true,
  isAnonymized: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const mockReviewService = {
  createReview: jest.fn(),
  getReviewsForFreelancer: jest.fn(),
  getReviewById: jest.fn(),
  updateReview: jest.fn(),
  anonymizeReview: jest.fn(),
  deleteReview: jest.fn(),
};

describe('ReviewController', () => {
  let controller: ReviewController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewController],
      providers: [{ provide: ReviewService, useValue: mockReviewService }],
    })
      .overrideGuard(
        // bypass JWT guard so we can test controller logic in isolation
        require('../../common/guards/jwt-auth.guard').JwtAuthGuard,
      )
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReviewController>(ReviewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('delegates to service.createReview and returns the result', async () => {
      const dto: CreateReviewDto = {
        freelancerId: 'freelancer-uuid-1',
        customerId: 'customer-uuid-1',
        rating: 5,
        comment: 'Great!',
        locale: 'en',
        transactionCurrency: 'USD',
        gdprConsentGiven: true,
      };
      const review = makeReview();
      mockReviewService.createReview.mockResolvedValue(review);

      const result = await controller.create(dto);

      expect(mockReviewService.createReview).toHaveBeenCalledWith(dto);
      expect(result).toEqual(review);
    });
  });

  describe('findByFreelancer', () => {
    it('returns all reviews for the specified freelancer', async () => {
      const reviews = [makeReview(), makeReview({ id: 'review-uuid-2', rating: 4 })];
      mockReviewService.getReviewsForFreelancer.mockResolvedValue(reviews);

      const result = await controller.findByFreelancer('freelancer-uuid-1');

      expect(mockReviewService.getReviewsForFreelancer).toHaveBeenCalledWith('freelancer-uuid-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('returns the review when found', async () => {
      const review = makeReview();
      mockReviewService.getReviewById.mockResolvedValue(review);

      const result = await controller.findOne('review-uuid-1');

      expect(result.id).toBe('review-uuid-1');
    });

    it('propagates NotFoundException from the service', async () => {
      mockReviewService.getReviewById.mockRejectedValue(
        new NotFoundException('Review with id non-existent not found'),
      );

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('delegates update to the service and returns the updated review', async () => {
      const updated = makeReview({ rating: 3 });
      mockReviewService.updateReview.mockResolvedValue(updated);

      const result = await controller.update('review-uuid-1', { rating: 3 });

      expect(mockReviewService.updateReview).toHaveBeenCalledWith('review-uuid-1', { rating: 3 });
      expect(result.rating).toBe(3);
    });
  });

  describe('anonymize', () => {
    it('calls service.anonymizeReview and returns the anonymized review', async () => {
      const anonymized = makeReview({ customerId: 'REDACTED', comment: 'REDACTED', isAnonymized: true });
      mockReviewService.anonymizeReview.mockResolvedValue(anonymized);

      const result = await controller.anonymize('review-uuid-1');

      expect(mockReviewService.anonymizeReview).toHaveBeenCalledWith('review-uuid-1');
      expect(result.isAnonymized).toBe(true);
    });
  });

  describe('remove', () => {
    it('calls service.deleteReview and returns void', async () => {
      mockReviewService.deleteReview.mockResolvedValue(undefined);

      await expect(controller.remove('review-uuid-1')).resolves.toBeUndefined();

      expect(mockReviewService.deleteReview).toHaveBeenCalledWith('review-uuid-1');
    });
  });
});
