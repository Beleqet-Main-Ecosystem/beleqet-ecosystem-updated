import { Test, TestingModule } from '@nestjs/testing';
import { AiFeedService } from './ai-feed.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Unit tests for `AiFeedService`.
 *
 * `PrismaService` is fully mocked here (no real database) so these tests
 * exercise only the recommendation/scoring logic in isolation. End-to-end
 * behavior — routing, auth guard, validation pipe — is covered separately
 * in `test/ai-feed.e2e-spec.ts`.
 */
describe('AiFeedService', () => {
  let service: AiFeedService;
  let prisma: PrismaService;

  const mockJobs = [
    {
      id: '1',
      title: 'React Developer',
      description: 'Build UI with React',
      status: 'PUBLISHED',
      currency: 'USD',
      salaryMin: 1000,
      salaryMax: 2000,
      tags: ['react'],
      categoryId: 'cat-frontend',
      createdAt: new Date('2026-01-02'),
      company: null,
      category: null,
    },
    {
      id: '2',
      title: 'Python Backend',
      description: 'API development in Python',
      status: 'PUBLISHED',
      currency: 'ETB',
      salaryMin: 1500,
      salaryMax: 2500,
      tags: ['python'],
      categoryId: 'cat-backend',
      createdAt: new Date('2026-01-01'),
      company: null,
      category: null,
    },
  ];

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ gdprConsent: true, skills: [] }),
    },
    searchHistory: {
      findMany: jest.fn().mockResolvedValue([{ searchTerm: 'React' }, { searchTerm: 'Remote' }]),
    },
    savedJob: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    job: {
      findMany: jest.fn().mockResolvedValue(mockJobs),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.user.findUnique.mockResolvedValue({ gdprConsent: true, skills: [] });
    mockPrismaService.searchHistory.findMany.mockResolvedValue([
      { searchTerm: 'React' },
      { searchTerm: 'Remote' },
    ]);
    mockPrismaService.savedJob.findMany.mockResolvedValue([]);
    mockPrismaService.job.findMany.mockResolvedValue(mockJobs);

    const module: TestingModule = await Test.createTestingModule({
      providers: [AiFeedService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<AiFeedService>(AiFeedService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPersonalizedFeed', () => {
    it('returns a generic feed and skips personal data lookups when GDPR consent is false', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ gdprConsent: false, skills: [] });

      const result = await service.getPersonalizedFeed('user-1', 5);

      expect(result).toHaveLength(2);
      expect(result.every((job) => job.relevanceScore === 0)).toBe(true);
      expect(prisma.searchHistory.findMany).not.toHaveBeenCalled();
      expect(prisma.savedJob.findMany).not.toHaveBeenCalled();
    });

    it('ranks jobs higher when they match the user search history', async () => {
      const result = await service.getPersonalizedFeed('user-1', 5);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].relevanceScore).toBeGreaterThan(result[1].relevanceScore);
    });

    it('falls back to skills when search history is empty', async () => {
      mockPrismaService.searchHistory.findMany.mockResolvedValue([]);
      mockPrismaService.user.findUnique.mockResolvedValue({
        gdprConsent: true,
        skills: ['python'],
      });

      const result = await service.getPersonalizedFeed('user-1', 5);

      expect(result[0].id).toBe('2');
      expect(result[0].relevanceScore).toBeGreaterThan(result[1].relevanceScore);
    });

    it('gives a category-affinity bonus to jobs from a previously saved category', async () => {
      mockPrismaService.searchHistory.findMany.mockResolvedValue([]);
      mockPrismaService.savedJob.findMany.mockResolvedValue([
        { job: { categoryId: 'cat-backend' } },
      ]);

      const result = await service.getPersonalizedFeed('user-1', 5);

      expect(result[0].id).toBe('2');
      expect(result[0].relevanceScore).toBe(30);
    });

    it('returns a generic feed when the user has no usable signal at all', async () => {
      mockPrismaService.searchHistory.findMany.mockResolvedValue([]);
      mockPrismaService.savedJob.findMany.mockResolvedValue([]);

      const result = await service.getPersonalizedFeed('user-1', 5);

      expect(result.every((job) => job.relevanceScore === 0)).toBe(true);
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('bounds the candidate query instead of loading every published job', async () => {
      const result = await service.getPersonalizedFeed('user-1', 5);

      expect(result).toHaveLength(2);
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 150,
          where: expect.objectContaining({
            status: 'PUBLISHED',
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('does not throw when a job has a null/undefined tags array', async () => {
      mockPrismaService.job.findMany.mockResolvedValue([
        { ...mockJobs[0], tags: null },
        mockJobs[1],
      ]);

      await expect(service.getPersonalizedFeed('user-1', 5)).resolves.toBeDefined();
    });

    it('respects the limit parameter', async () => {
      const result = await service.getPersonalizedFeed('user-1', 1);
      expect(result).toHaveLength(1);
    });

    it('does not award a false-positive match for a substring keyword (e.g. "net" in "network")', async () => {
      mockPrismaService.searchHistory.findMany.mockResolvedValue([{ searchTerm: 'net' }]);
      mockPrismaService.job.findMany.mockResolvedValue([
        {
          ...mockJobs[0],
          id: '3',
          title: 'Network Engineer',
          description: 'Manage the planetary network',
          tags: [],
        },
      ]);

      const result = await service.getPersonalizedFeed('user-1', 5);

      expect(result[0].relevanceScore).toBe(0);
    });

    it('fetches keyword and category candidates as separate bounded pools', async () => {
      mockPrismaService.savedJob.findMany.mockResolvedValue([
        { job: { categoryId: 'cat-backend' } },
      ]);

      await service.getPersonalizedFeed('user-1', 5);

      // One call for keyword matches, one for category affinity — not a
      // single combined OR clause with one shared `take`.
      expect(prisma.job.findMany).toHaveBeenCalledTimes(2);
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 150, where: expect.objectContaining({ OR: expect.any(Array) }) }),
      );
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          where: expect.objectContaining({ categoryId: { in: ['cat-backend'] } }),
        }),
      );
    });

    it('matches a keyword containing punctuation against job text (e.g. "Node.js")', async () => {
      // extractKeywords and tokenize must split text identically, or a
      // keyword like "Node.js" (kept whole by a whitespace-only split) can
      // never be found among job tokens (split into "node"/"js" by a
      // non-alphanumeric split) -> the job is fetched as a candidate but
      // always scores 0.
      mockPrismaService.searchHistory.findMany.mockResolvedValue([{ searchTerm: 'Node.js' }]);
      mockPrismaService.job.findMany.mockResolvedValue([
        {
          ...mockJobs[0],
          id: '4',
          title: 'Node.js Developer',
          description: 'Build APIs with Node.js',
          tags: [],
        },
      ]);

      const result = await service.getPersonalizedFeed('user-1', 5);

      expect(result[0].relevanceScore).toBeGreaterThan(0);
    });

    it('prioritizes recent search terms over static skills when truncating to MAX_KEYWORDS', async () => {
      const searchWords = [
        'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot',
        'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima',
      ];
      mockPrismaService.searchHistory.findMany.mockResolvedValue(
        searchWords.map((word) => ({ searchTerm: word })),
      );
      mockPrismaService.user.findUnique.mockResolvedValue({
        gdprConsent: true,
        skills: ['zuluskill'],
      });

      await service.getPersonalizedFeed('user-1', 5);

      const [[callArgs]] = (prisma.job.findMany as jest.Mock).mock.calls;
      const titleKeywords = callArgs.where.OR
        .filter((clause: { title?: { contains: string } }) => clause.title)
        .map((clause: { title: { contains: string } }) => clause.title.contains);

      expect(titleKeywords).toEqual(expect.arrayContaining(searchWords));
      expect(titleKeywords).not.toEqual(expect.arrayContaining(['zuluskill']));
    });
  });
});