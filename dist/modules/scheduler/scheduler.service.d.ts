import Redis from 'ioredis';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class SchedulerService {
    private readonly redis;
    private readonly subscriptionsService;
    private readonly notificationsService;
    private readonly logger;
    constructor(redis: Redis, subscriptionsService: SubscriptionsService, notificationsService: NotificationsService);
    handleExpirySweep(): Promise<void>;
    handleExpiryReminders(): Promise<void>;
    private withLock;
}
