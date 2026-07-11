/**
 * @file reviews.controller.spec.ts
 * @description
 * Unit tests for ReviewsController.
 * Tests endpoint routing, authentication guards, and response handling.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: ReviewsService;

  const mockReviewsService = {
    createReview: jest.fn(),
    getFreelancerReviews: jest.fn(),
    getFreelancerRatingStats: jest.fn(),
    getReviewById: jest.fn(),
  };

  const mockUser = {
    userId: 'user-1',
    email: 'test@example.com',
    role: 'EMPLOYER',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ReviewsController>(ReviewsController);
    service = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    const createReviewDto: CreateReviewDto = {
      contractId: 'contract-1',
      revieweeId: 'reviewee-1',
      rating: 5,
      comment: 'Excellent work!',
    };

    const mockCreatedReview = {
      id: 'review-1',
      contractId: 'contract-1',
      reviewerId: 'user-1',
      revieweeId: 'reviewee-1',
      rating: 5,
      comment: 'Excellent work!',
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewer: {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: null,
      },
      reviewee: {
        id: 'reviewee-1',
        firstName: 'Jane',
        lastName: 'Smith',
        avatarUrl: null,
      },
    };

    it('should create a review and return it', async () => {
      mockReviewsService.createReview.mockResolvedValue(mockCreatedReview);

      const result = await controller.createReview(mockUser as any, createReviewDto);

      expect(result).toEqual(mockCreatedReview);
      expect(service.createReview).toHaveBeenCalledWith('user-1', createReviewDto);
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockReviewsService.createReview.mockRejectedValue(error);

      await expect(controller.createReview(mockUser as any, createReviewDto)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getFreelancerReviews', () => {
    const mockReviews = [
      {
        id: 'review-1',
        rating: 5,
        comment: 'Excellent!',
        createdAt: new Date(),
        reviewer: {
          id: 'reviewer-1',
          firstName: 'John',
          lastName: 'Doe',
          avatarUrl: null,
        },
        contract: null,
      },
    ];

    it('should return reviews for a freelancer', async () => {
      mockReviewsService.getFreelancerReviews.mockResolvedValue(mockReviews);

      const result = await controller.getFreelancerReviews('freelancer-1');

      expect(result).toEqual(mockReviews);
      expect(service.getFreelancerReviews).toHaveBeenCalledWith('freelancer-1');
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockReviewsService.getFreelancerReviews.mockRejectedValue(error);

      await expect(controller.getFreelancerReviews('freelancer-1')).rejects.toThrow(error);
    });
  });

  describe('getFreelancerRatingStats', () => {
    const mockStats = {
      averageRating: 4.5,
      totalReviews: 10,
      ratingDistribution: {
        fiveStar: 7,
        fourStar: 2,
        threeStar: 1,
        twoStar: 0,
        oneStar: 0,
      },
    };

    it('should return rating statistics for a freelancer', async () => {
      mockReviewsService.getFreelancerRatingStats.mockResolvedValue(mockStats);

      const result = await controller.getFreelancerRatingStats('freelancer-1');

      expect(result).toEqual(mockStats);
      expect(service.getFreelancerRatingStats).toHaveBeenCalledWith('freelancer-1');
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockReviewsService.getFreelancerRatingStats.mockRejectedValue(error);

      await expect(controller.getFreelancerRatingStats('freelancer-1')).rejects.toThrow(error);
    });
  });

  describe('getReviewById', () => {
    const mockReview = {
      id: 'review-1',
      rating: 5,
      comment: 'Excellent!',
      createdAt: new Date(),
      reviewer: {
        id: 'reviewer-1',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: null,
      },
      reviewee: {
        id: 'reviewee-1',
        firstName: 'Jane',
        lastName: 'Smith',
        avatarUrl: null,
      },
      contract: null,
    };

    it('should return a review by ID', async () => {
      mockReviewsService.getReviewById.mockResolvedValue(mockReview);

      const result = await controller.getReviewById('review-1');

      expect(result).toEqual(mockReview);
      expect(service.getReviewById).toHaveBeenCalledWith('review-1');
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      mockReviewsService.getReviewById.mockRejectedValue(error);

      await expect(controller.getReviewById('review-1')).rejects.toThrow(error);
    });
  });
});
