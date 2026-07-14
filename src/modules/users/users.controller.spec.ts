import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

const mockSvc = {
  findById: jest.fn(),
  update: jest.fn(),
  getCompany: jest.fn(),
  createCompany: jest.fn(),
  getNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  getSavedJobs: jest.fn(),
  saveJob: jest.fn(),
  removeSavedJob: jest.fn(),
  getCvDraft: jest.fn(),
  saveCvDraft: jest.fn(),
  exportData: jest.fn(),
  requestDeletion: jest.fn(),
  cancelDeletion: jest.fn(),
};

const mockUser = { userId: 'u1', email: 'u@t.com', role: 'JOB_SEEKER' };

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockSvc }],
    }).compile();
    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('profile should return user', async () => {
    mockSvc.findById.mockResolvedValue({ id: 'u1' });
    const result = await controller.profile(mockUser);
    expect(result.id).toBe('u1');
  });

  it('update should update user', async () => {
    mockSvc.update.mockResolvedValue({ id: 'u1', firstName: 'Jane' });
    const result = await controller.update(mockUser, { firstName: 'Jane' });
    expect(result.firstName).toBe('Jane');
  });

  it('getCompany should return company', async () => {
    mockSvc.getCompany.mockResolvedValue({ id: 'c1' });
    const result = await controller.getCompany(mockUser);
    expect(result!.id).toBe('c1');
  });

  it('createCompany should create company', async () => {
    mockSvc.createCompany.mockResolvedValue({ id: 'c1' });
    const result = await controller.createCompany(mockUser, { name: 'Acme' } as any);
    expect(result.id).toBe('c1');
  });

  it('notifications should return notifications', async () => {
    mockSvc.getNotifications.mockResolvedValue([{ id: 'n1' }]);
    const result = await controller.notifications(mockUser);
    expect(result).toHaveLength(1);
  });

  it('markRead should mark notification read', async () => {
    mockSvc.markNotificationRead.mockResolvedValue({ count: 1 });
    const result = await controller.markRead('n1', mockUser);
    expect(result.count).toBe(1);
  });

  it('markAllRead should mark all notifications read', async () => {
    mockSvc.markAllNotificationsRead.mockResolvedValue({ count: 5 });
    const result = await controller.markAllRead(mockUser);
    expect(result.count).toBe(5);
  });

  it('savedJobs should return saved jobs', async () => {
    mockSvc.getSavedJobs.mockResolvedValue([]);
    const result = await controller.savedJobs(mockUser);
    expect(result).toEqual([]);
  });

  it('saveJob should save a job', async () => {
    mockSvc.saveJob.mockResolvedValue({ id: 's1' });
    const result = await controller.saveJob('j1', mockUser);
    expect(result.id).toBe('s1');
  });

  it('removeSavedJob should remove saved job', async () => {
    mockSvc.removeSavedJob.mockResolvedValue({ count: 1 });
    const result = await controller.removeSavedJob('j1', mockUser);
    expect(result.count).toBe(1);
  });

  it('cvDraft should return cv draft', async () => {
    mockSvc.getCvDraft.mockResolvedValue({ id: 'd1' });
    const result = await controller.cvDraft(mockUser);
    expect(result.id).toBe('d1');
  });

  it('saveCvDraft should save cv draft', async () => {
    mockSvc.saveCvDraft.mockResolvedValue({ id: 'd1' });
    const result = await controller.saveCvDraft({ data: { name: 'test' } }, mockUser);
    expect(result.id).toBe('d1');
  });

  it('exportData should return user data export', async () => {
    mockSvc.exportData.mockResolvedValue({ exportedAt: '2026-01-01', data: { id: 'u1' } });
    const result = await controller.exportData(mockUser);
    expect(result.exportedAt).toBeDefined();
    expect(result.data.id).toBe('u1');
  });

  it('requestDeletion should schedule account deletion', async () => {
    mockSvc.requestDeletion.mockResolvedValue({
      message: 'Scheduled',
      scheduledAt: '2026-01-01',
      cancelDeadline: '2026-01-31',
    });
    const result = await controller.requestDeletion(mockUser);
    expect(result.scheduledAt).toBeDefined();
    expect(result.cancelDeadline).toBeDefined();
  });

  it('cancelDeletion should cancel scheduled deletion', async () => {
    mockSvc.cancelDeletion.mockResolvedValue({ message: 'Cancelled' });
    const result = await controller.cancelDeletion(mockUser);
    expect(result.message).toContain('Cancelled');
  });
});
