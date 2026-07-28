import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
export interface AlertPayload {
    title: string;
    message: string;
    severity: 'HIGH' | 'CRITICAL' | 'WARNING';
    timestamp: string;
}
export declare class AlertingService {
    private readonly notificationsQueue;
    private readonly config;
    private readonly logger;
    private readonly slackWebhookUrl;
    constructor(notificationsQueue: Queue, config: ConfigService);
    dispatchAlert(payload: AlertPayload): Promise<void>;
    private sendEmailAlert;
    private sendSlackAlert;
}
