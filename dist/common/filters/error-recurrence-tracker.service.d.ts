import { ErrorCode } from './all-exceptions.filter';
export interface RecurrenceSnapshot {
    errorCode: ErrorCode;
    hitCount: number;
    alertTriggered: boolean;
    recentTimestamps: string[];
    topPaths: string[];
}
export declare class ErrorRecurrenceTrackerService {
    private readonly windowMs;
    private readonly threshold;
    private readonly logger;
    private readonly store;
    private readonly alerted;
    constructor(windowMs?: number, threshold?: number);
    track(errorCode: ErrorCode, path: string, message: string): void;
    getSnapshot(): RecurrenceSnapshot[];
    getByCode(errorCode: ErrorCode): RecurrenceSnapshot | null;
    reset(): void;
    private triggerAlert;
    private topN;
}
