import { Test, TestingModule } from '@nestjs/testing';
import { AiFeedService } from './ai-feed.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AiFeedService', () => {
  let service: AiFeedService;
  let prisma: PrismaService;

  const mockJobs = [
    { id: '1', title: 'React Developer', description: 'Build UI', status: 'PUBLISHED', currency: 'USD', salaryMin: 1000, salaryMax: 2000, tags: ['react'], company: null, category: null },
    { id: '2', title: 'Python Backend', description: 'API development', status: 'PUBLISHED', currency: 'EUR', salaryMin: 1500, salaryMax: 2500, tags: ['python'], company: null, category: null },
  ];

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ gdprConsent: true }),
    },
    searchHistory: {
      findMany: jest.fn().mockResolvedValue([{ searchTerm: 'React' }, { searchTerm: 'Remote' }]),
    },
    job: {
      findMany: jest.fn().mockResolvedValue(mockJobs),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiFeedService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AiFeedService>(AiFeedService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPersonalizedFeed', () => {
    it('should return generic jobs when GDPR consent is false', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ gdprConsent: false });
      const result = await service.getPersonalizedFeed('user-1', 5);
      expect(result).toEqual(mockJobs);
      expect(prisma.job.findMany).toHaveBeenCalled();
    });

    it('should return personalized jobs based on search history', async () => {
      const result = await service.getPersonalizedFeed('user-1', 5);
      expect(result).toHaveLength(2);
      // The first job has 'React' in title, so it should score higher than job 2
      expect(result[0].relevanceScore).toBeGreaterThanOrEqual(result[1]?.relevanceScore || 0);
    });

    it('should return generic jobs if search history is empty', async () => {
      jest.spyOn(prisma.searchHistory, 'findMany').mockResolvedValue([]);
      const result = await service.getPersonalizedFeed('user-1', 5);
      expect(result).toEqual(mockJobs);
    });
  });
});
