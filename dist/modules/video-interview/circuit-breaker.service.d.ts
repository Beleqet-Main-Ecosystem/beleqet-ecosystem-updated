import { I18nService } from 'nestjs-i18n';
export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
interface CircuitBreakerOptions {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    executionTimeout: number;
}
export declare class CircuitBreakerService {
    private readonly i18n;
    private readonly logger;
    private readonly circuits;
    private readonly defaults;
    constructor(i18n: I18nService);
    execute<T>(circuitName: string, action: () => Promise<T>, options?: Partial<CircuitBreakerOptions>, lang?: string): Promise<T>;
    getState(circuitName: string): CircuitState;
    reset(circuitName: string): void;
    private runWithExecutionTimeout;
    private fastFail;
    private recordSuccess;
    private recordFailure;
    private getOrCreate;
}
export {};
