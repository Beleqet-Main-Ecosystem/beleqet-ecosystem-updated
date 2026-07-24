import { Test, TestingModule } from '@nestjs/testing';
import { CompanyLoader } from './company.loader';
import { PrismaService } from '../../prisma/prisma.service';

describe('CompanyLoader', () => {
  let loader: CompanyLoader;
  let prisma: PrismaService;

  const mockPrisma = {
    company: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyLoader,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    // Loaders with Scope.REQUEST must be resolved using module.resolve
    loader = await module.resolve<CompanyLoader>(CompanyLoader);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should batch load companies and perfectly prevent N+1 queries', async () => {
    mockPrisma.company.findMany.mockResolvedValue([
      { id: '1', name: 'Company One' },
      { id: '2', name: 'Company Two' },
    ]);

    // We simulate 3 separate children resolving their company field simultaneously.
    // Notice that '1' is requested twice.
    const result = await Promise.all([
      loader.batchLoad.load('1'),
      loader.batchLoad.load('2'),
      loader.batchLoad.load('1'), 
    ]);

    // The entire point of DataLoader: the database should only be hit EXACTLY ONCE.
    expect(mockPrisma.company.findMany).toHaveBeenCalledTimes(1);
    
    // It should aggressively batch the unique IDs.
    expect(mockPrisma.company.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['1', '2'] } },
    });
    
    // It should map the results back perfectly to the original callers.
    expect(result).toEqual([
      { id: '1', name: 'Company One' },
      { id: '2', name: 'Company Two' },
      { id: '1', name: 'Company One' },
    ]);
  });
});
