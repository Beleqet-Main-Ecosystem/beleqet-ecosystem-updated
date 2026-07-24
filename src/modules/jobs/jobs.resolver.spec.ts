import { Test, TestingModule } from '@nestjs/testing';
import { JobsResolver } from './jobs.resolver';
import { JobsService } from './jobs.service';
import { CompanyLoader } from '../../graphql/loaders/company.loader';
import { CategoryLoader } from '../../graphql/loaders/category.loader';

describe('JobsResolver', () => {
  let resolver: JobsResolver;
  let service: JobsService;

  const mockJobsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockCompanyLoader = {
    batchLoad: { load: jest.fn() },
  };

  const mockCategoryLoader = {
    batchLoad: { load: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsResolver,
        { provide: JobsService, useValue: mockJobsService },
        { provide: CompanyLoader, useValue: mockCompanyLoader },
        { provide: CategoryLoader, useValue: mockCategoryLoader },
      ],
    }).compile();

    resolver = module.get<JobsResolver>(JobsResolver);
    service = module.get<JobsService>(JobsService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('jobs query', () => {
    it('should successfully return paginated jobs', async () => {
      const mockResult = {
        items: [{ id: '1', title: 'Senior Developer' }],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };
      
      mockJobsService.findAll.mockResolvedValue(mockResult);

      const result = await resolver.jobs({});
      
      expect(result).toEqual(mockResult);
      expect(service.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('job query', () => {
    it('should successfully return a single job by ID', async () => {
      const mockJob = { id: '123', title: 'Senior Developer' };
      
      mockJobsService.findOne.mockResolvedValue(mockJob);

      const result = await resolver.job('123');
      
      expect(result).toEqual(mockJob);
      expect(service.findOne).toHaveBeenCalledWith('123');
    });
  });
  
  describe('Field Resolvers', () => {
    it('should resolve company dynamically using DataLoader', async () => {
      const mockJob = { id: '1', companyId: 'comp-1' };
      mockCompanyLoader.batchLoad.load.mockResolvedValue({ id: 'comp-1', name: 'Tech Corp' });
      
      const result = await resolver.company(mockJob);
      
      expect(result).toEqual({ id: 'comp-1', name: 'Tech Corp' });
      expect(mockCompanyLoader.batchLoad.load).toHaveBeenCalledWith('comp-1');
    });
  });
});
