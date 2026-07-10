import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PlatformSourceService } from './platform-source.service';
import { PlagiarismConfig } from '../utils/plagiarism.config';
import { PrismaService } from '../../../prisma/prisma.service';

describe('PlatformSourceService', () => {
  let service: PlatformSourceService;

  const mockPrisma = {
    job: { findMany: jest.fn().mockResolvedValue([{ id: 'j1', title: 'Dev', description: 'Code', requirements: 'TS' }]) },
    freelanceJob: { findMany: jest.fn().mockResolvedValue([]) },
    application: { findMany: jest.fn().mockResolvedValue([]) },
    bid: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    company: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSourceService,
        PlagiarismConfig,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlatformSourceService>(PlatformSourceService);
  });

  it('loads platform documents from database', async () => {
    const docs = await service.loadDocuments();
    expect(docs.length).toBe(1);
    expect(docs[0].entityType).toBe('Job');
    expect(docs[0].sourceType).toBe('platform');
  });

  it('excludes specified entity ID', async () => {
    const docs = await service.loadDocuments('j1');
    expect(docs.length).toBe(0);
  });
});
