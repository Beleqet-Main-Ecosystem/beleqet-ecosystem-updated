/**
 * @file reviews.service.spec.ts
 * @description
 * Unit tests for ReviewsService.
 * Tests review creation, retrieval, rating calculations, and validation logic.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { I18nService } from 'nestjs-i18n';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    review: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    contract: {
      findUnique: jest.fn(),
    },
  };

  const mockI18nService = {
    t: jest.fn((key: string) => key),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    const mockReviewer = {
      id: 'reviewer-1',
      firstName: 'John',
      lastName: 'Doe',
      avatarUrl: null,
    };

    const mockReviewee = {
      id: 'reviewee-1',
      firstName: 'Jane',
      lastName: 'Smith',
      avatarUrl: null,
    };

    const mockContract = {
      id: 'contract-1',
      clientId: 'reviewer-1',
      freelancerId: 'reviewee-1',
      status: 'COMPLETED',
      review: null,
    };

    const mockCreatedReview = {
      id: 'review-1',
      contractId: 'contract-1',
      reviewerId: 'reviewer-1',
      revieweeId: 'reviewee-1',
      rating: 5,
      comment: 'Excellent work!',
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewer: mockReviewer,
      reviewee: mockReviewee,
    };

    const createReviewDto: CreateReviewDto = {
      contractId: 'contract-1',
      revieweeId: 'reviewee-1',
      rating: 5,
      comment: 'Excellent work!',
    };

    it('should create a review successfully', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockReviewer)
        .mockResolvedValueOnce(mockReviewee);
      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaService.review.create.mockResolvedValue(mockCreatedReview);

      const result = await service.createReview('reviewer-1', createReviewDto);

      expect(result).toEqual(mockCreatedReview);
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
      expect(prismaService.contract.findUnique).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
        include: { review: true },
      });
      expect(prismaService.review.create).toHaveBeenCalledWith({
        data: {
          contractId: 'contract-1',
          reviewerId: 'reviewer-1',
          revieweeId: 'reviewee-1',
          rating: 5,
          comment: 'Excellent work!',
        },
        include: {
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          reviewee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException if reviewer does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);

      await expect(service.createReview('invalid-id', createReviewDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.createReview('invalid-id', createReviewDto)).rejects.toThrow(
        'reviews.REVIEWER_NOT_FOUND',
      );
    });

    it('should throw NotFoundException if reviewee does not exist', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockReviewer)
        .mockResolvedValueOnce(null);

      await expect(service.createReview('reviewer-1', createReviewDto)).rejects.toThrow(
        'reviews.REVIEWEE_NOT_FOUND',
      );
    });

    it('should throw BadRequestException if user tries to review themselves', async () => {
      const selfReviewDto: CreateReviewDto = {
        ...createReviewDto,
        revieweeId: 'reviewer-1',
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockReviewer)
        .mockResolvedValueOnce(mockReviewer);

      await expect(service.createReview('reviewer-1', selfReviewDto)).rejects.toThrow(
        'reviews.CANNOT_REVIEW_YOURSELF',
      );
    });

    it('should throw NotFoundException if contract does not exist', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockReviewer)
        .mockResolvedValueOnce(mockReviewee);
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(service.createReview('reviewer-1', createReviewDto)).rejects.toThrow(
        'reviews.CONTRACT_NOT_FOUND',
      );
    });

    it('should throw ForbiddenException if contract does not belong to correct parties', async () => {
      const wrongContract = {
        ...mockContract,
        clientId: 'other-user',
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockReviewer)
        .mockResolvedValueOnce(mockReviewee);
      mockPrismaService.contract.findUnique.mockResolvedValue(wrongContract);

      await expect(service.createReview('reviewer-1', createReviewDto)).rejects.toThrow(
        'reviews.CONTRACT_NOT_BELONGS',
      );
    });

    it('should throw BadRequestException if review already exists for contract', async () => {
      const contractWithReview = {
        ...mockContract,
        review: { id: 'existing-review' },
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockReviewer)
        .mockResolvedValueOnce(mockReviewee);
      mockPrismaService.contract.findUnique.mockResolvedValue(contractWithReview);

      await expect(service.createReview('reviewer-1', createReviewDto)).rejects.toThrow(
        'reviews.REVIEW_ALREADY_EXISTS',
      );
    });

    it('should throw BadRequestException if contract is not completed', async () => {
      const activeContract = {
        ...mockContract,
        status: 'ACTIVE',
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockReviewer)
        .mockResolvedValueOnce(mockReviewee);
      mockPrismaService.contract.findUnique.mockResolvedValue(activeContract);

      await expect(service.createReview('reviewer-1', createReviewDto)).rejects.toThrow(
        'reviews.CONTRACT_NOT_COMPLETED',
      );
    });

    it('should create review without contract if contractId is not provided', async () => {
      const dtoWithoutContract: CreateReviewDto = {
        revieweeId: 'reviewee-1',
        rating: 4,
        comment: 'Good work',
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockReviewer)
        .mockResolvedValueOnce(mockReviewee);
      mockPrismaService.review.create.mockResolvedValue({
        ...mockCreatedReview,
        contractId: null,
        rating: 4,
        comment: 'Good work',
      });

      const result = await service.createReview('reviewer-1', dtoWithoutContract);

      expect(result).toBeDefined();
      expect(prismaService.contract.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('getFreelancerReviews', () => {
    const mockReviewee = {
      id: 'reviewee-1',
      firstName: 'Jane',
      lastName: 'Smith',
    };

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
      mockPrismaService.user.findUnique.mockResolvedValue(mockReviewee);
      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getFreelancerReviews('reviewee-1');

      expect(result).toEqual(mockReviews);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'reviewee-1' },
      });
      expect(prismaService.review.findMany).toHaveBeenCalledWith({
        where: { revieweeId: 'reviewee-1' },
        include: {
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          contract: {
            select: {
              id: true,
              freelanceJob: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw NotFoundException if freelancer does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getFreelancerReviews('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getFreelancerReviews('invalid-id')).rejects.toThrow(
        'reviews.FREELANCER_NOT_FOUND',
      );
    });
  });

  describe('getFreelancerRatingStats', () => {
    const mockReviewee = {
      id: 'reviewee-1',
      firstName: 'Jane',
      lastName: 'Smith',
    };

    it('should return rating statistics for a freelancer with reviews', async () => {
      const mockReviews = [
        { rating: 5 },
        { rating: 4 },
        { rating: 5 },
        { rating: 3 },
        { rating: 5 },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue(mockReviewee);
      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getFreelancerRatingStats('reviewee-1');

      expect(result).toEqual({
        averageRating: 4.4,
        totalReviews: 5,
        ratingDistribution: {
          fiveStar: 3,
          fourStar: 1,
          threeStar: 1,
          twoStar: 0,
          oneStar: 0,
        },
      });
    });

    it('should return zero stats for freelancer with no reviews', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockReviewee);
      mockPrismaService.review.findMany.mockResolvedValue([]);

      const result = await service.getFreelancerRatingStats('reviewee-1');

      expect(result).toEqual({
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: {
          fiveStar: 0,
          fourStar: 0,
          threeStar: 0,
          twoStar: 0,
          oneStar: 0,
        },
      });
    });

    it('should throw NotFoundException if freelancer does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getFreelancerRatingStats('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getFreelancerRatingStats('invalid-id')).rejects.toThrow(
        'reviews.FREELANCER_NOT_FOUND',
      );
    });

    it('should correctly calculate average rating with one decimal place', async () => {
      const mockReviews = [
        { rating: 5 },
        { rating: 4 },
        { rating: 3 },
      ];

      mockPrismaService.user.findUnique.mockResolvedValue(mockReviewee);
      mockPrismaService.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.getFreelancerRatingStats('reviewee-1');

      expect(result.averageRating).toBe(4.0);
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
      mockPrismaService.review.findUnique.mockResolvedValue(mockReview);

      const result = await service.getReviewById('review-1');

      expect(result).toEqual(mockReview);
      expect(prismaService.review.findUnique).toHaveBeenCalledWith({
        where: { id: 'review-1' },
        include: {
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          reviewee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          contract: {
            select: {
              id: true,
              freelanceJob: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      });
    });

    it('should throw NotFoundException if review does not exist', async () => {
      mockPrismaService.review.findUnique.mockResolvedValue(null);

      await expect(service.getReviewById('invalid-id')).rejects.toThrow(NotFoundException);
      await expect(service.getReviewById('invalid-id')).rejects.toThrow('reviews.REVIEW_NOT_FOUND');
    });
  });
});
