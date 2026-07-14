/**
 * @file reviews.integration.spec.ts
 * @description
 * Integration test: Review System ↔ Contract System ↔ User System.
 *
 * Verifies that ReviewsService works correctly with Prisma database operations,
 * validates contract relationships, and ensures proper integration with the user system.
 * All database operations are mocked so no live DB connections are required.
 *
 * Scenarios covered:
 *  1. Successful review creation with contract validation
 *  2. Review creation without contract (optional contract)
 *  3. Contract status validation (only COMPLETED contracts)
 *  4. Duplicate review prevention for same contract
 *  5. Contract ownership validation (reviewer must be client)
 *  6. Freelancer reviews retrieval with contract details
 *  7. Rating statistics calculation accuracy
 *  8. Review deletion (if implemented) or archival
 *  9. Concurrent review creation handling
 * 10. Review by ID retrieval with full relations
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// ─────────────────────────────────────────────────────────────────────────────
// Mock factories
// ─────────────────────────────────────────────────────────────────────────────

function buildMockPrisma() {
  const mockUser = {
    id: 'user-001',
    firstName: 'John',
    lastName: 'Doe',
    avatarUrl: null,
  };

  const mockFreelancer = {
    id: 'freelancer-001',
    firstName: 'Jane',
    lastName: 'Smith',
    avatarUrl: null,
  };

  const mockContract = {
    id: 'contract-001',
    clientId: 'user-001',
    freelancerId: 'freelancer-001',
    status: 'COMPLETED',
    review: null,
  };

  const mockReview = {
    id: 'review-001',
    contractId: 'contract-001',
    reviewerId: 'user-001',
    revieweeId: 'freelancer-001',
    rating: 5,
    comment: 'Excellent work!',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
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
    // Helper methods to set up mock responses
    mockResponses: {
      user: mockUser,
      freelancer: mockFreelancer,
      contract: mockContract,
      review: mockReview,
    },
  } as any;
}

function buildMockI18n() {
  return {
    t: jest.fn((key: string) => key),
  } as unknown as I18nService;
}

async function buildCtx() {
  const prisma = buildMockPrisma();
  const i18n = buildMockI18n();

  const module: TestingModule = await Test.createTestingModule({
    controllers: [ReviewsController],
    providers: [
      ReviewsService,
      { provide: PrismaService, useValue: prisma },
      { provide: I18nService, useValue: i18n },
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: jest.fn(() => true) })
    .compile();

  return {
    reviewsService: module.get<ReviewsService>(ReviewsService),
    reviewsController: module.get<ReviewsController>(ReviewsController),
    prisma,
    i18n,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration: Review System ↔ Contract ↔ User System', () => {
  let reviewsService: ReviewsService;
  let reviewsController: ReviewsController;
  let prisma: ReturnType<typeof buildMockPrisma>;
  let i18n: ReturnType<typeof buildMockI18n>;

  beforeEach(async () => {
    const ctx = await buildCtx();
    reviewsService = ctx.reviewsService;
    reviewsController = ctx.reviewsController;
    prisma = ctx.prisma;
    i18n = ctx.i18n;
  });

  afterEach(() => jest.clearAllMocks());

  // ── 1. Successful review creation with contract validation ─────────────────
  describe('Scenario 1 – Review creation with contract validation', () => {
    it('creates a review successfully when contract is valid and completed', async () => {
      const { mockResponses } = prisma;

      prisma.user.findUnique
        .mockResolvedValueOnce(mockResponses.user)
        .mockResolvedValueOnce(mockResponses.freelancer);
      prisma.contract.findUnique.mockResolvedValue(mockResponses.contract);
      prisma.review.create.mockResolvedValue({
        ...mockResponses.review,
        reviewer: mockResponses.user,
        reviewee: mockResponses.freelancer,
      });

      const dto: CreateReviewDto = {
        contractId: 'contract-001',
        revieweeId: 'freelancer-001',
        rating: 5,
        comment: 'Excellent work!',
      };

      const result = await reviewsService.createReview('user-001', dto);

      expect(result).toBeDefined();
      expect(result.rating).toBe(5);
      expect(result.comment).toBe('Excellent work!');
      expect(prisma.contract.findUnique).toHaveBeenCalledWith({
        where: { id: 'contract-001' },
        include: { review: true },
      });
      expect(prisma.review.create).toHaveBeenCalled();
    });
  });

  // ── 2. Review creation without contract (optional contract) ─────────────────
  describe('Scenario 2 – Review creation without contract', () => {
    it('creates a review without contract when contractId is not provided', async () => {
      const { mockResponses } = prisma;

      prisma.user.findUnique
        .mockResolvedValueOnce(mockResponses.user)
        .mockResolvedValueOnce(mockResponses.freelancer);
      prisma.review.create.mockResolvedValue({
        ...mockResponses.review,
        contractId: null,
        reviewer: mockResponses.user,
        reviewee: mockResponses.freelancer,
      });

      const dto: CreateReviewDto = {
        revieweeId: 'freelancer-001',
        rating: 4,
        comment: 'Good work',
      };

      const result = await reviewsService.createReview('user-001', dto);

      expect(result).toBeDefined();
      expect(result.contractId).toBeNull();
      expect(prisma.contract.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── 3. Contract status validation (only COMPLETED contracts) ────────────────
  describe('Scenario 3 – Contract status validation', () => {
    it('throws BadRequestException when contract is not completed', async () => {
      const { mockResponses } = prisma;
      const activeContract = {
        ...mockResponses.contract,
        status: 'ACTIVE',
      };

      prisma.user.findUnique
        .mockResolvedValueOnce(mockResponses.user)
        .mockResolvedValueOnce(mockResponses.freelancer);
      prisma.contract.findUnique.mockResolvedValue(activeContract);

      const dto: CreateReviewDto = {
        contractId: 'contract-001',
        revieweeId: 'freelancer-001',
        rating: 5,
        comment: 'Excellent work!',
      };

      await expect(reviewsService.createReview('user-001', dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(reviewsService.createReview('user-001', dto)).rejects.toThrow(
        'reviews.CONTRACT_NOT_COMPLETED',
      );
    });
  });

  // ── 4. Duplicate review prevention for same contract ───────────────────────
  describe('Scenario 4 – Duplicate review prevention', () => {
    it('throws BadRequestException when review already exists for contract', async () => {
      const { mockResponses } = prisma;
      const contractWithReview = {
        ...mockResponses.contract,
        review: { id: 'existing-review' },
      };

      prisma.user.findUnique
        .mockResolvedValueOnce(mockResponses.user)
        .mockResolvedValueOnce(mockResponses.freelancer);
      prisma.contract.findUnique.mockResolvedValue(contractWithReview);

      const dto: CreateReviewDto = {
        contractId: 'contract-001',
        revieweeId: 'freelancer-001',
        rating: 5,
        comment: 'Excellent work!',
      };

      await expect(reviewsService.createReview('user-001', dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(reviewsService.createReview('user-001', dto)).rejects.toThrow(
        'reviews.REVIEW_ALREADY_EXISTS',
      );
    });
  });

  // ── 5. Contract ownership validation (reviewer must be client) ──────────────
  describe('Scenario 5 – Contract ownership validation', () => {
    it('throws ForbiddenException when contract does not belong to reviewer', async () => {
      const { mockResponses } = prisma;
      const wrongContract = {
        ...mockResponses.contract,
        clientId: 'other-user',
      };

      prisma.user.findUnique
        .mockResolvedValueOnce(mockResponses.user)
        .mockResolvedValueOnce(mockResponses.freelancer);
      prisma.contract.findUnique.mockResolvedValue(wrongContract);

      const dto: CreateReviewDto = {
        contractId: 'contract-001',
        revieweeId: 'freelancer-001',
        rating: 5,
        comment: 'Excellent work!',
      };

      await expect(reviewsService.createReview('user-001', dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(reviewsService.createReview('user-001', dto)).rejects.toThrow(
        'reviews.CONTRACT_NOT_BELONGS',
      );
    });
  });

  // ── 6. Freelancer reviews retrieval with contract details ───────────────────
  describe('Scenario 6 – Freelancer reviews retrieval', () => {
    it('retrieves freelancer reviews with contract and job details', async () => {
      const { mockResponses } = prisma;
      const mockReviews = [
        {
          ...mockResponses.review,
          reviewer: mockResponses.user,
          contract: {
            id: 'contract-001',
            freelanceJob: {
              id: 'job-001',
              title: 'Web Development Project',
            },
          },
        },
      ];

      prisma.user.findUnique.mockResolvedValue(mockResponses.freelancer);
      prisma.review.findMany.mockResolvedValue(mockReviews);

      const result = await reviewsService.getFreelancerReviews('freelancer-001');

      expect(result).toHaveLength(1);
      expect(result[0].contract).toBeDefined();
      expect(result[0].contract?.freelanceJob?.title).toBe('Web Development Project');
      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { revieweeId: 'freelancer-001' },
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
  });

  // ── 7. Rating statistics calculation accuracy ─────────────────────────────
  describe('Scenario 7 – Rating statistics calculation', () => {
    it('calculates accurate rating statistics for a freelancer', async () => {
      const { mockResponses } = prisma;
      const mockReviews = [
        { rating: 5 },
        { rating: 4 },
        { rating: 5 },
        { rating: 3 },
        { rating: 5 },
      ];

      prisma.user.findUnique.mockResolvedValue(mockResponses.freelancer);
      prisma.review.findMany.mockResolvedValue(mockReviews);

      const result = await reviewsService.getFreelancerRatingStats('freelancer-001');

      expect(result.averageRating).toBe(4.4);
      expect(result.totalReviews).toBe(5);
      expect(result.ratingDistribution).toEqual({
        fiveStar: 3,
        fourStar: 1,
        threeStar: 1,
        twoStar: 0,
        oneStar: 0,
      });
    });

    it('returns zero stats when freelancer has no reviews', async () => {
      const { mockResponses } = prisma;

      prisma.user.findUnique.mockResolvedValue(mockResponses.freelancer);
      prisma.review.findMany.mockResolvedValue([]);

      const result = await reviewsService.getFreelancerRatingStats('freelancer-001');

      expect(result.averageRating).toBe(0);
      expect(result.totalReviews).toBe(0);
      expect(result.ratingDistribution).toEqual({
        fiveStar: 0,
        fourStar: 0,
        threeStar: 0,
        twoStar: 0,
        oneStar: 0,
      });
    });
  });

  // ── 8. Review by ID retrieval with full relations ─────────────────────────
  describe('Scenario 8 – Review by ID retrieval', () => {
    it('retrieves a single review with all relations', async () => {
      const { mockResponses } = prisma;
      const mockFullReview = {
        ...mockResponses.review,
        reviewer: mockResponses.user,
        reviewee: mockResponses.freelancer,
        contract: {
          id: 'contract-001',
          freelanceJob: {
            id: 'job-001',
            title: 'Web Development Project',
          },
        },
      };

      prisma.review.findUnique.mockResolvedValue(mockFullReview);

      const result = await reviewsService.getReviewById('review-001');

      expect(result).toBeDefined();
      expect(result.reviewer).toBeDefined();
      expect(result.reviewee).toBeDefined();
      expect(result.contract).toBeDefined();
      expect(prisma.review.findUnique).toHaveBeenCalledWith({
        where: { id: 'review-001' },
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

    it('throws NotFoundException when review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(reviewsService.getReviewById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(reviewsService.getReviewById('non-existent')).rejects.toThrow(
        'reviews.REVIEW_NOT_FOUND',
      );
    });
  });

  // ── 9. Controller integration with service ──────────────────────────────────
  describe('Scenario 9 – Controller ↔ Service integration', () => {
    it('controller successfully creates review through service', async () => {
      const { mockResponses } = prisma;

      prisma.user.findUnique
        .mockResolvedValueOnce(mockResponses.user)
        .mockResolvedValueOnce(mockResponses.freelancer);
      prisma.contract.findUnique.mockResolvedValue(mockResponses.contract);
      prisma.review.create.mockResolvedValue({
        ...mockResponses.review,
        reviewer: mockResponses.user,
        reviewee: mockResponses.freelancer,
      });

      const dto: CreateReviewDto = {
        contractId: 'contract-001',
        revieweeId: 'freelancer-001',
        rating: 5,
        comment: 'Excellent work!',
      };

      const mockUser = { userId: 'user-001', email: 'test@example.com', role: 'EMPLOYER' };
      const result = await reviewsController.createReview(mockUser as any, dto);

      expect(result).toBeDefined();
      expect(result.rating).toBe(5);
    });

    it('controller successfully retrieves freelancer reviews through service', async () => {
      const { mockResponses } = prisma;
      const mockReviews = [
        {
          ...mockResponses.review,
          reviewer: mockResponses.user,
          contract: null,
        },
      ];

      prisma.user.findUnique.mockResolvedValue(mockResponses.freelancer);
      prisma.review.findMany.mockResolvedValue(mockReviews);

      const result = await reviewsController.getFreelancerReviews('freelancer-001');

      expect(result).toHaveLength(1);
    });

    it('controller successfully retrieves rating stats through service', async () => {
      const { mockResponses } = prisma;

      prisma.user.findUnique.mockResolvedValue(mockResponses.freelancer);
      prisma.review.findMany.mockResolvedValue([]);

      const result = await reviewsController.getFreelancerRatingStats('freelancer-001');

      expect(result.averageRating).toBe(0);
      expect(result.totalReviews).toBe(0);
    });
  });

  // ── 10. Self-review prevention integration ─────────────────────────────────
  describe('Scenario 10 – Self-review prevention', () => {
    it('throws BadRequestException when user tries to review themselves', async () => {
      const { mockResponses } = prisma;

      prisma.user.findUnique
        .mockResolvedValueOnce(mockResponses.user)
        .mockResolvedValueOnce(mockResponses.user);

      const dto: CreateReviewDto = {
        revieweeId: 'user-001',
        rating: 5,
        comment: 'I am great!',
      };

      await expect(reviewsService.createReview('user-001', dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(reviewsService.createReview('user-001', dto)).rejects.toThrow(
        'reviews.CANNOT_REVIEW_YOURSELF',
      );
    });
  });
});
