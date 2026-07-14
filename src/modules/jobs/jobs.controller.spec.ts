import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

const mockJobsService = {
  findAll: jest.fn(),
  findByCompany: jest.fn(),
  getCategories: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('JobsController', () => {
  let controller: JobsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [{ provide: JobsService, useValue: mockJobsService }],
    }).compile();
    controller = module.get<JobsController>(JobsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated jobs', async () => {
      mockJobsService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      const result = await controller.findAll({ page: 1 });
      expect(result.total).toBe(0);
    });
  });

  describe('myJobs', () => {
    it('should return employer jobs', async () => {
      mockJobsService.findByCompany.mockResolvedValue([{ id: 'j1' }]);
      const result = await controller.myJobs({ userId: 'emp-1', email: 'e', role: 'EMPLOYER' });
      expect(result).toHaveLength(1);
    });
  });

  describe('getCategories', () => {
    it('should return categories', async () => {
      mockJobsService.getCategories.mockResolvedValue([]);
      const result = await controller.getCategories();
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a job', async () => {
      mockJobsService.findOne.mockResolvedValue({ id: 'j1' });
      const result = await controller.findOne('j1');
      expect(result.id).toBe('j1');
    });
  });

  describe('create', () => {
    it('should create a job', async () => {
      mockJobsService.create.mockResolvedValue({ id: 'j1' });
      const result = await controller.create(
        { userId: 'emp-1', email: 'e', role: 'EMPLOYER' },
        { title: 'Dev', description: 'd', location: 'Addis', type: 'FULL_TIME' as any, categoryId: 'c1' },
      );
      expect(result.id).toBe('j1');
    });
  });

  describe('update', () => {
    it('should update a job', async () => {
      mockJobsService.update.mockResolvedValue({ id: 'j1', title: 'New' });
      const result = await controller.update('j1', { userId: 'emp-1', email: 'e', role: 'EMPLOYER' }, { title: 'New' });
      expect(result.title).toBe('New');
    });
  });

  describe('remove', () => {
    it('should remove a job', async () => {
      mockJobsService.remove.mockResolvedValue({ id: 'j1', status: 'ARCHIVED' });
      const result = await controller.remove('j1', { userId: 'emp-1', email: 'e', role: 'EMPLOYER' });
      expect(result.status).toBe('ARCHIVED');
    });
  });
});
