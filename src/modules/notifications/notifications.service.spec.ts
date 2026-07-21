import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bull';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
  },
  notificationPreference: {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  },
  pushSubscription: {
    upsert: jest.fn(),
  },
};

const mockQueue = {
  add: jest.fn(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPreferences', () => {
    it('should return existing preferences if they exist', async () => {
      const mockPrefs = { userId: 'user-1', email: true, sms: false, push: true, inApp: true };
      mockPrismaService.notificationPreference.findUnique.mockResolvedValue(mockPrefs);

      const result = await service.getPreferences('user-1');
      expect(result).toEqual(mockPrefs);
    });

    it('should create and return default preferences if they do not exist', async () => {
      mockPrismaService.notificationPreference.findUnique.mockResolvedValue(null);
      const defaultPrefs = { userId: 'user-1', email: true, sms: true, push: true, inApp: true };
      mockPrismaService.notificationPreference.create.mockResolvedValue(defaultPrefs);

      const result = await service.getPreferences('user-1');
      expect(result).toEqual(defaultPrefs);
    });
  });

  describe('sendNotification', () => {
    it('should add all channels to the queue if preferences are all true', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@beleqet.com',
        phone: '+251911234567',
        pushSubscriptions: [{ endpoint: 'ep-1', p256dh: 'dh', auth: 'auth' }],
      });

      mockPrismaService.notificationPreference.findUnique.mockResolvedValue({
        userId: 'user-1',
        email: true,
        sms: true,
        push: true,
        inApp: true,
      });

      await service.sendNotification('user-1', 'TEST', 'Test Title', 'Test Body');

      expect(mockQueue.add).toHaveBeenCalledWith(NOTIFICATION_JOBS.SEND_IN_APP, expect.any(Object));
      expect(mockQueue.add).toHaveBeenCalledWith(NOTIFICATION_JOBS.SEND_EMAIL, expect.any(Object));
      expect(mockQueue.add).toHaveBeenCalledWith(NOTIFICATION_JOBS.SEND_SMS, expect.any(Object));
      expect(mockQueue.add).toHaveBeenCalledWith(NOTIFICATION_JOBS.SEND_PUSH, expect.any(Object));
    });

    it('should not queue email or sms if user opts out', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@beleqet.com',
        phone: '+251911234567',
        pushSubscriptions: [],
      });

      mockPrismaService.notificationPreference.findUnique.mockResolvedValue({
        userId: 'user-1',
        email: false,
        sms: false,
        push: true,
        inApp: true,
      });

      await service.sendNotification('user-1', 'TEST', 'Test Title', 'Test Body');

      expect(mockQueue.add).toHaveBeenCalledWith(NOTIFICATION_JOBS.SEND_IN_APP, expect.any(Object));
      expect(mockQueue.add).not.toHaveBeenCalledWith(NOTIFICATION_JOBS.SEND_EMAIL, expect.any(Object));
      expect(mockQueue.add).not.toHaveBeenCalledWith(NOTIFICATION_JOBS.SEND_SMS, expect.any(Object));
    });
  });
});
